// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IPriceOracle {
    event PriceFeedSet(bytes32 indexed assetId, address feedAddress);
    event PriceFeedRemoved(bytes32 indexed assetId);

    function getLatestPrice(
        bytes32 assetId
    ) external view returns (int256 price, uint8 decimals, uint256 updatedAt);

    function setPriceFeed(bytes32 assetId, address feedAddress) external;

    function removePriceFeed(bytes32 assetId) external;

    function isPriceFeedStale(
        bytes32 assetId,
        uint256 maxAge
    ) external view returns (bool);
}
