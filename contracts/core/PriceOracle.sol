// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/AssetTypes.sol";

contract PriceOracle is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IPriceOracle
{
    bytes32 public constant ORACLE_ADMIN_ROLE =
        keccak256("ORACLE_ADMIN_ROLE");

    mapping(bytes32 => address) private _priceFeeds;
    uint256 public defaultStalenessThreshold;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        uint256 stalenessThreshold
    ) public initializer {
        __AccessControl_init();


        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);

        defaultStalenessThreshold = stalenessThreshold;
    }

    function setPriceFeed(
        bytes32 assetId,
        address feedAddress
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        if (feedAddress == address(0))
            revert AssetTypes.InvalidParameter("feedAddress");

        _priceFeeds[assetId] = feedAddress;
        emit PriceFeedSet(assetId, feedAddress);
    }

    function removePriceFeed(
        bytes32 assetId
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        delete _priceFeeds[assetId];
        emit PriceFeedRemoved(assetId);
    }

    function getLatestPrice(
        bytes32 assetId
    )
        external
        view
        returns (int256 price, uint8 feedDecimals, uint256 updatedAt)
    {
        address feedAddr = _priceFeeds[assetId];
        if (feedAddr == address(0))
            revert AssetTypes.InvalidParameter("assetId not configured");

        AggregatorV3Interface feed = AggregatorV3Interface(feedAddr);
        (, int256 answer, , uint256 updatedAtRaw, ) = feed.latestRoundData();

        if (answer <= 0) revert AssetTypes.InvalidParameter("invalid price");
        if (
            defaultStalenessThreshold > 0 &&
            block.timestamp - updatedAtRaw > defaultStalenessThreshold
        ) {
            revert AssetTypes.InvalidParameter("stale price");
        }

        return (answer, feed.decimals(), updatedAtRaw);
    }

    function isPriceFeedStale(
        bytes32 assetId,
        uint256 maxAge
    ) external view returns (bool) {
        address feedAddr = _priceFeeds[assetId];
        if (feedAddr == address(0)) return true;

        AggregatorV3Interface feed = AggregatorV3Interface(feedAddr);
        (, , , uint256 updatedAt, ) = feed.latestRoundData();

        return block.timestamp - updatedAt > maxAge;
    }

    function setDefaultStalenessThreshold(
        uint256 threshold
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        defaultStalenessThreshold = threshold;
    }

    function getPriceFeed(bytes32 assetId) external view returns (address) {
        return _priceFeeds[assetId];
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
