// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../libraries/AssetTypes.sol";

contract FractionalLandToken is
    Initializable,
    ERC1155Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardTransient
{
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct FractionInfo {
        uint256 landTokenId;
        address landTokenContract;
        uint256 totalFractions;
        uint256 pricePerFraction;
        bool active;
    }

    struct RentInfo {
        uint256 totalRent;
        uint256 claimedRent;
        mapping(address => uint256) lastClaimedRent;
    }

    IComplianceRegistry public complianceRegistry;

    uint256 private _nextFractionId;
    mapping(uint256 => FractionInfo) public fractionInfo;
    mapping(uint256 => uint256) private _totalRentPool;
    mapping(uint256 => uint256) private _totalRentDistributed;
    mapping(uint256 => mapping(address => uint256)) private _lastClaimedCumulative;

    event Fractionalized(
        uint256 indexed fractionId,
        uint256 indexed landTokenId,
        address landTokenContract,
        uint256 totalFractions
    );
    event FractionsMinted(
        uint256 indexed fractionId,
        address indexed to,
        uint256 amount
    );
    event RentDistributed(uint256 indexed fractionId, uint256 amount);
    event RentClaimed(
        uint256 indexed fractionId,
        address indexed holder,
        uint256 amount
    );
    event ComplianceRegistryUpdated(address indexed newRegistry);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory uri_,
        address registry,
        address admin
    ) public initializer {
        __ERC1155_init(uri_);
        __AccessControl_init();

        complianceRegistry = IComplianceRegistry(registry);
        _nextFractionId = 1;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function fractionalize(
        uint256 landTokenId,
        address landTokenContract,
        uint256 totalFractions,
        uint256 pricePerFraction
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        if (totalFractions == 0)
            revert AssetTypes.InvalidParameter("totalFractions");
        if (landTokenContract == address(0))
            revert AssetTypes.InvalidParameter("landTokenContract");

        uint256 fractionId = _nextFractionId++;
        fractionInfo[fractionId] = FractionInfo({
            landTokenId: landTokenId,
            landTokenContract: landTokenContract,
            totalFractions: totalFractions,
            pricePerFraction: pricePerFraction,
            active: true
        });

        emit Fractionalized(
            fractionId,
            landTokenId,
            landTokenContract,
            totalFractions
        );
        return fractionId;
    }

    function mintFractions(
        uint256 fractionId,
        address to,
        uint256 amount
    ) external onlyRole(REGISTRAR_ROLE) {
        if (!fractionInfo[fractionId].active)
            revert AssetTypes.AssetNotActive();
        if (!complianceRegistry.isWhitelisted(to))
            revert AssetTypes.NotWhitelisted(to);

        _mint(to, fractionId, amount, "");
        emit FractionsMinted(fractionId, to, amount);
    }

    function distributeRent(
        uint256 fractionId
    ) external payable onlyRole(REGISTRAR_ROLE) {
        if (msg.value == 0) revert AssetTypes.InvalidParameter("amount");
        if (!fractionInfo[fractionId].active)
            revert AssetTypes.AssetNotActive();

        _totalRentPool[fractionId] += msg.value;
        _totalRentDistributed[fractionId] += msg.value;

        emit RentDistributed(fractionId, msg.value);
    }

    function claimRent(uint256 fractionId) external nonReentrant {
        uint256 balance = balanceOf(msg.sender, fractionId);
        if (balance == 0) revert AssetTypes.InvalidParameter("no fractions");

        FractionInfo storage info = fractionInfo[fractionId];
        uint256 totalRent = _totalRentPool[fractionId];
        uint256 lastClaimed = _lastClaimedCumulative[fractionId][msg.sender];

        if (totalRent <= lastClaimed)
            revert AssetTypes.InvalidParameter("no rent to claim");

        uint256 unclaimedPerFraction = (totalRent - lastClaimed);
        uint256 payout = (unclaimedPerFraction * balance) /
            info.totalFractions;

        if (payout == 0) revert AssetTypes.InvalidParameter("payout is zero");

        _lastClaimedCumulative[fractionId][msg.sender] = totalRent;

        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        if (!sent) revert AssetTypes.InsufficientFunds();

        emit RentClaimed(fractionId, msg.sender, payout);
    }

    function getFractionInfo(
        uint256 fractionId
    ) external view returns (FractionInfo memory) {
        return fractionInfo[fractionId];
    }

    function totalRentDistributed(
        uint256 fractionId
    ) external view returns (uint256) {
        return _totalRentDistributed[fractionId];
    }

    function setComplianceRegistry(
        address registry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registry == address(0))
            revert AssetTypes.InvalidParameter("registry");
        complianceRegistry = IComplianceRegistry(registry);
        emit ComplianceRegistryUpdated(registry);
    }

    // Compliance check on transfers
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        if (from != address(0) && to != address(0)) {
            if (!complianceRegistry.canTransfer(from, to, 0))
                revert AssetTypes.TransferRestricted(from, to);
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC1155Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
