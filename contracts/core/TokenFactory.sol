// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../interfaces/ITokenFactory.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/AssetTypes.sol";

// Import token contracts for initialization encoding
import "../tokens/EquityToken.sol";
import "../tokens/BondToken.sol";
import "../tokens/LandToken.sol";
import "../tokens/FractionalLandToken.sol";
import "../derivatives/FuturesContract.sol";
import "../derivatives/OptionsContract.sol";

contract TokenFactory is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ITokenFactory
{
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    address public complianceRegistry;
    address public priceOracle;

    mapping(AssetTypes.AssetCategory => address) public implementations;

    AssetTypes.AssetInfo[] private _deployedAssets;
    mapping(address => uint256) private _assetIndex; // token address => index+1
    mapping(AssetTypes.AssetCategory => address[])
        private _assetsByCategory;

    event ImplementationSet(
        AssetTypes.AssetCategory indexed category,
        address implementation
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address registry,
        address oracle
    ) public initializer {
        __AccessControl_init();


        if (registry == address(0))
            revert AssetTypes.InvalidParameter("registry");
        if (oracle == address(0))
            revert AssetTypes.InvalidParameter("oracle");

        complianceRegistry = registry;
        priceOracle = oracle;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DEPLOYER_ROLE, admin);
    }

    function setImplementation(
        AssetTypes.AssetCategory category,
        address implementation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (implementation == address(0))
            revert AssetTypes.InvalidParameter("implementation");

        implementations[category] = implementation;
        emit ImplementationSet(category, implementation);
    }

    function deployEquity(
        string calldata name,
        string calldata symbol,
        string calldata cusip,
        uint256 totalShares
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        address impl = implementations[AssetTypes.AssetCategory.EQUITY];
        if (impl == address(0))
            revert AssetTypes.InvalidParameter("no equity implementation");

        bytes memory initData = abi.encodeCall(
            EquityToken.initialize,
            (
                name,
                symbol,
                complianceRegistry,
                priceOracle,
                msg.sender,
                cusip,
                totalShares
            )
        );

        address proxy = _deployProxy(impl, initData);
        _registerAsset(
            proxy,
            AssetTypes.AssetCategory.EQUITY,
            name,
            symbol,
            msg.sender
        );
        return proxy;
    }

    function deployBond(
        string calldata name,
        string calldata symbol,
        AssetTypes.BondTerms calldata terms
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        address impl = implementations[AssetTypes.AssetCategory.BOND];
        if (impl == address(0))
            revert AssetTypes.InvalidParameter("no bond implementation");

        bytes memory initData = abi.encodeCall(
            BondToken.initialize,
            (
                name,
                symbol,
                complianceRegistry,
                priceOracle,
                msg.sender,
                terms
            )
        );

        address proxy = _deployProxy(impl, initData);
        _registerAsset(
            proxy,
            AssetTypes.AssetCategory.BOND,
            name,
            symbol,
            msg.sender
        );
        return proxy;
    }

    function deployFutures(
        string calldata name,
        string calldata symbol,
        AssetTypes.FuturesTerms calldata terms
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        address impl = implementations[
            AssetTypes.AssetCategory.DERIVATIVE_FUTURE
        ];
        if (impl == address(0))
            revert AssetTypes.InvalidParameter("no futures implementation");

        bytes memory initData = abi.encodeCall(
            FuturesContract.initialize,
            (
                name,
                symbol,
                complianceRegistry,
                priceOracle,
                msg.sender,
                terms
            )
        );

        address proxy = _deployProxy(impl, initData);
        _registerAsset(
            proxy,
            AssetTypes.AssetCategory.DERIVATIVE_FUTURE,
            name,
            symbol,
            msg.sender
        );
        return proxy;
    }

    function deployOptions(
        string calldata name,
        string calldata symbol,
        AssetTypes.OptionsTerms calldata terms
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        address impl = implementations[
            AssetTypes.AssetCategory.DERIVATIVE_OPTION
        ];
        if (impl == address(0))
            revert AssetTypes.InvalidParameter("no options implementation");

        bytes memory initData = abi.encodeCall(
            OptionsContract.initialize,
            (
                name,
                symbol,
                complianceRegistry,
                priceOracle,
                msg.sender,
                terms
            )
        );

        address proxy = _deployProxy(impl, initData);
        _registerAsset(
            proxy,
            AssetTypes.AssetCategory.DERIVATIVE_OPTION,
            name,
            symbol,
            msg.sender
        );
        return proxy;
    }

    function deployLandToken(
        string calldata name,
        string calldata symbol
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        address impl = implementations[AssetTypes.AssetCategory.LAND];
        if (impl == address(0))
            revert AssetTypes.InvalidParameter("no land implementation");

        bytes memory initData = abi.encodeCall(
            LandToken.initialize,
            (name, symbol, complianceRegistry, msg.sender)
        );

        address proxy = _deployProxy(impl, initData);
        _registerAsset(
            proxy,
            AssetTypes.AssetCategory.LAND,
            name,
            symbol,
            msg.sender
        );
        return proxy;
    }

    function deployFractionalLand(
        string calldata uri
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        address impl = implementations[
            AssetTypes.AssetCategory.FRACTIONAL_LAND
        ];
        if (impl == address(0))
            revert AssetTypes.InvalidParameter(
                "no fractional land implementation"
            );

        bytes memory initData = abi.encodeCall(
            FractionalLandToken.initialize,
            (uri, complianceRegistry, msg.sender)
        );

        address proxy = _deployProxy(impl, initData);
        _registerAsset(
            proxy,
            AssetTypes.AssetCategory.FRACTIONAL_LAND,
            "FractionalLand",
            "FLAND",
            msg.sender
        );
        return proxy;
    }

    function getDeployedAssets()
        external
        view
        returns (AssetTypes.AssetInfo[] memory)
    {
        return _deployedAssets;
    }

    function getAssetsByCategory(
        AssetTypes.AssetCategory category
    ) external view returns (address[] memory) {
        return _assetsByCategory[category];
    }

    function getAssetInfo(
        address token
    ) external view returns (AssetTypes.AssetInfo memory) {
        uint256 idx = _assetIndex[token];
        if (idx == 0) revert AssetTypes.InvalidParameter("not deployed");
        return _deployedAssets[idx - 1];
    }

    function isDeployedAsset(address token) external view returns (bool) {
        return _assetIndex[token] > 0;
    }

    function deployedAssetsCount() external view returns (uint256) {
        return _deployedAssets.length;
    }

    function _deployProxy(
        address implementation,
        bytes memory initData
    ) internal returns (address) {
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        return address(proxy);
    }

    function _registerAsset(
        address tokenAddress,
        AssetTypes.AssetCategory category,
        string memory name,
        string memory symbol,
        address assetIssuer
    ) internal {
        AssetTypes.AssetInfo memory info = AssetTypes.AssetInfo({
            tokenAddress: tokenAddress,
            category: category,
            name: name,
            symbol: symbol,
            issuer: assetIssuer,
            createdAt: block.timestamp,
            active: true
        });

        _deployedAssets.push(info);
        _assetIndex[tokenAddress] = _deployedAssets.length;
        _assetsByCategory[category].push(tokenAddress);

        emit AssetDeployed(tokenAddress, category, name, symbol, assetIssuer);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
