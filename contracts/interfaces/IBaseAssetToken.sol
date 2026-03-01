// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/AssetTypes.sol";

interface IBaseAssetToken {
    event ComplianceRegistryUpdated(address indexed newRegistry);
    event PriceOracleUpdated(address indexed newOracle);

    function assetCategory()
        external
        view
        returns (AssetTypes.AssetCategory);
    function complianceRegistry() external view returns (address);
    function priceOracle() external view returns (address);
    function issuer() external view returns (address);
    function createdAt() external view returns (uint256);
    function setComplianceRegistry(address registry) external;
    function setPriceOracle(address oracle) external;
}
