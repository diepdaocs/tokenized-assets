// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library AssetTypes {
    enum AssetCategory {
        EQUITY,
        BOND,
        DERIVATIVE_FUTURE,
        DERIVATIVE_OPTION,
        LAND,
        FRACTIONAL_LAND
    }

    enum InvestorStatus {
        NONE,
        PENDING,
        WHITELISTED,
        BLACKLISTED
    }

    enum OptionType {
        CALL,
        PUT
    }

    enum DerivativeState {
        ACTIVE,
        SETTLED,
        EXPIRED,
        CANCELLED
    }

    struct AssetInfo {
        address tokenAddress;
        AssetCategory category;
        string name;
        string symbol;
        address issuer;
        uint256 createdAt;
        bool active;
    }

    struct DividendCheckpoint {
        uint256 snapshotId;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 blockTimestamp;
    }

    struct BondTerms {
        uint256 faceValue;
        uint256 couponRateBps; // basis points (500 = 5%)
        uint256 couponInterval; // seconds between payments
        uint256 maturityDate; // unix timestamp
        uint256 issueDate; // unix timestamp
    }

    struct FuturesTerms {
        address underlyingAsset;
        uint256 contractSize;
        uint256 settlementDate;
        uint256 maintenanceMarginBps;
        uint256 initialMarginBps;
        bytes32 priceId;
    }

    struct OptionsTerms {
        address underlyingAsset;
        uint256 strikePrice;
        uint256 expirationDate;
        uint256 contractSize;
        OptionType optionType;
        uint256 premiumPerContract;
        bytes32 priceId;
    }

    struct LandProperty {
        string propertyId;
        string jurisdiction;
        uint256 areaSqMeters;
        uint256 valuationUsd; // 18 decimals
        string metadataURI;
        bool fractionalized;
    }

    // Custom errors
    error NotWhitelisted(address account);
    error TransferRestricted(address from, address to);
    error AssetNotActive();
    error InsufficientMargin();
    error ContractExpired();
    error ContractNotExpired();
    error AlreadySettled();
    error InvalidParameter(string param);
    error AlreadyClaimed();
    error InsufficientFunds();
    error Unauthorized();
}
