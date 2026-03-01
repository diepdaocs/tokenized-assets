// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/AssetTypes.sol";

interface ITokenFactory {
    event AssetDeployed(
        address indexed tokenAddress,
        AssetTypes.AssetCategory indexed category,
        string name,
        string symbol,
        address indexed issuer
    );

    function deployEquity(
        string calldata name,
        string calldata symbol,
        string calldata cusip,
        uint256 totalShares
    ) external returns (address);

    function deployBond(
        string calldata name,
        string calldata symbol,
        AssetTypes.BondTerms calldata terms
    ) external returns (address);

    function deployFutures(
        string calldata name,
        string calldata symbol,
        AssetTypes.FuturesTerms calldata terms
    ) external returns (address);

    function deployOptions(
        string calldata name,
        string calldata symbol,
        AssetTypes.OptionsTerms calldata terms
    ) external returns (address);

    function deployLandToken(
        string calldata name,
        string calldata symbol
    ) external returns (address);

    function deployFractionalLand(
        string calldata uri
    ) external returns (address);

    function getDeployedAssets()
        external
        view
        returns (AssetTypes.AssetInfo[] memory);

    function getAssetsByCategory(
        AssetTypes.AssetCategory category
    ) external view returns (address[] memory);

    function getAssetInfo(
        address token
    ) external view returns (AssetTypes.AssetInfo memory);

    function isDeployedAsset(address token) external view returns (bool);
}
