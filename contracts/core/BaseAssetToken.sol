// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/AssetTypes.sol";

abstract contract BaseAssetToken is
    Initializable,
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardTransient
{
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IComplianceRegistry public complianceRegistry;
    IPriceOracle public priceOracle;
    AssetTypes.AssetCategory public assetCategory;
    address public issuer;
    uint256 public createdAt;
    bytes32 public assetPriceId;

    event ComplianceRegistryUpdated(address indexed newRegistry);
    event PriceOracleUpdated(address indexed newOracle);

    function __BaseAssetToken_init(
        string memory name_,
        string memory symbol_,
        address registry,
        address oracle,
        AssetTypes.AssetCategory category,
        address issuer_
    ) internal onlyInitializing {
        __ERC20_init(name_, symbol_);
        __ERC20Pausable_init();
        __AccessControl_init();

        complianceRegistry = IComplianceRegistry(registry);
        priceOracle = IPriceOracle(oracle);
        assetCategory = category;
        issuer = issuer_;
        createdAt = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, issuer_);
        _grantRole(ISSUER_ROLE, issuer_);
        _grantRole(OPERATOR_ROLE, issuer_);
    }

    function mint(
        address to,
        uint256 amount
    ) public virtual onlyRole(ISSUER_ROLE) {
        _mint(to, amount);
    }

    function burn(uint256 amount) public virtual {
        _burn(msg.sender, amount);
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

    function setPriceOracle(
        address oracle
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (oracle == address(0))
            revert AssetTypes.InvalidParameter("oracle");
        priceOracle = IPriceOracle(oracle);
        emit PriceOracleUpdated(oracle);
    }

    function setAssetPriceId(
        bytes32 priceId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetPriceId = priceId;
    }

    function getAssetValuation()
        external
        view
        returns (int256 price, uint8 decimals)
    {
        (price, decimals, ) = priceOracle.getLatestPrice(assetPriceId);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        // Compliance check: skip for mint (from==0) and burn (to==0)
        if (from != address(0) && to != address(0)) {
            if (!complianceRegistry.canTransfer(from, to, value)) {
                revert AssetTypes.TransferRestricted(from, to);
            }
        }
        super._update(from, to, value);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
