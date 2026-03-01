// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/AssetTypes.sol";

abstract contract DerivativeBase is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct Position {
        address holder;
        bool isLong;
        uint256 size;
        uint256 margin;
        uint256 entryPrice;
        bool active;
    }

    IComplianceRegistry public complianceRegistry;
    IPriceOracle public priceOracle;
    AssetTypes.DerivativeState public state;
    address public issuer;
    uint256 public createdAt;

    uint256 internal _nextPositionId;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) internal _holderPositions;

    uint256 public totalLongSize;
    uint256 public totalShortSize;

    event PositionOpened(
        uint256 indexed positionId,
        address indexed holder,
        bool isLong,
        uint256 size,
        uint256 margin,
        uint256 entryPrice
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed holder,
        uint256 payout
    );
    event MarginAdded(uint256 indexed positionId, uint256 amount);
    event ContractSettled(uint256 settlementPrice);
    event ComplianceRegistryUpdated(address indexed newRegistry);

    function __DerivativeBase_init(
        address registry,
        address oracle,
        address issuer_
    ) internal onlyInitializing {
        __AccessControl_init();
        __Pausable_init();

        // ReentrancyGuard uses transient storage, no init needed

        complianceRegistry = IComplianceRegistry(registry);
        priceOracle = IPriceOracle(oracle);
        issuer = issuer_;
        createdAt = block.timestamp;
        state = AssetTypes.DerivativeState.ACTIVE;
        _nextPositionId = 1;

        _grantRole(DEFAULT_ADMIN_ROLE, issuer_);
        _grantRole(OPERATOR_ROLE, issuer_);
    }

    modifier onlyActive() {
        if (state != AssetTypes.DerivativeState.ACTIVE)
            revert AssetTypes.AssetNotActive();
        _;
    }

    modifier onlyCompliant(address account) {
        if (!complianceRegistry.isWhitelisted(account))
            revert AssetTypes.NotWhitelisted(account);
        _;
    }

    function addMargin(uint256 positionId) external payable nonReentrant {
        Position storage pos = positions[positionId];
        if (!pos.active) revert AssetTypes.InvalidParameter("position not active");
        if (pos.holder != msg.sender) revert AssetTypes.Unauthorized();
        if (msg.value == 0) revert AssetTypes.InvalidParameter("amount");

        pos.margin += msg.value;
        emit MarginAdded(positionId, msg.value);
    }

    function getHolderPositions(
        address holder
    ) external view returns (uint256[] memory) {
        return _holderPositions[holder];
    }

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    function setComplianceRegistry(
        address registry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registry == address(0))
            revert AssetTypes.InvalidParameter("registry");
        complianceRegistry = IComplianceRegistry(registry);
        emit ComplianceRegistryUpdated(registry);
    }

    function _openPosition(
        address holder,
        bool isLong,
        uint256 size,
        uint256 margin,
        uint256 entryPrice
    ) internal returns (uint256 positionId) {
        positionId = _nextPositionId++;
        positions[positionId] = Position({
            holder: holder,
            isLong: isLong,
            size: size,
            margin: margin,
            entryPrice: entryPrice,
            active: true
        });
        _holderPositions[holder].push(positionId);

        if (isLong) {
            totalLongSize += size;
        } else {
            totalShortSize += size;
        }

        emit PositionOpened(
            positionId,
            holder,
            isLong,
            size,
            margin,
            entryPrice
        );
    }

    function _closePosition(
        uint256 positionId,
        uint256 payout
    ) internal {
        Position storage pos = positions[positionId];
        pos.active = false;

        if (pos.isLong) {
            totalLongSize -= pos.size;
        } else {
            totalShortSize -= pos.size;
        }

        if (payout > 0) {
            (bool sent, ) = payable(pos.holder).call{value: payout}("");
            if (!sent) revert AssetTypes.InsufficientFunds();
        }

        emit PositionClosed(positionId, pos.holder, payout);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
