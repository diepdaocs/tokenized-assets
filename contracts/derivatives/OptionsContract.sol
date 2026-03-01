// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DerivativeBase.sol";
import "../libraries/AssetTypes.sol";

contract OptionsContract is DerivativeBase {
    AssetTypes.OptionsTerms public optionsTerms;
    uint256 public settlementPrice;

    // Writers who provide collateral
    mapping(address => uint256) public writerCollateral;
    uint256 public totalCollateral;
    uint256 public totalOptionsBought;

    event OptionWritten(address indexed writer, uint256 numContracts, uint256 collateral);
    event OptionBought(uint256 indexed positionId, address indexed buyer, uint256 numContracts, uint256 premium);
    event OptionExercised(uint256 indexed positionId, address indexed holder, uint256 payout);
    event OptionsExpired(uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory /* name_ */,
        string memory /* symbol_ */,
        address registry,
        address oracle,
        address issuer_,
        AssetTypes.OptionsTerms memory terms
    ) public initializer {
        __DerivativeBase_init(registry, oracle, issuer_);

        if (terms.expirationDate <= block.timestamp)
            revert AssetTypes.InvalidParameter("expirationDate");
        if (terms.strikePrice == 0)
            revert AssetTypes.InvalidParameter("strikePrice");
        if (terms.contractSize == 0)
            revert AssetTypes.InvalidParameter("contractSize");
        if (terms.premiumPerContract == 0)
            revert AssetTypes.InvalidParameter("premiumPerContract");

        optionsTerms = terms;
    }

    function writeOption(
        uint256 numContracts
    )
        external
        payable
        nonReentrant
        whenNotPaused
        onlyActive
        onlyCompliant(msg.sender)
    {
        if (numContracts == 0)
            revert AssetTypes.InvalidParameter("numContracts");

        // Writer must deposit collateral = strikePrice * contractSize * numContracts
        uint256 requiredCollateral = optionsTerms.strikePrice *
            optionsTerms.contractSize *
            numContracts;

        if (msg.value < requiredCollateral)
            revert AssetTypes.InsufficientMargin();

        writerCollateral[msg.sender] += msg.value;
        totalCollateral += msg.value;

        emit OptionWritten(msg.sender, numContracts, msg.value);
    }

    function buyOption(
        uint256 numContracts
    )
        external
        payable
        nonReentrant
        whenNotPaused
        onlyActive
        onlyCompliant(msg.sender)
    {
        if (numContracts == 0)
            revert AssetTypes.InvalidParameter("numContracts");

        uint256 totalPremium = optionsTerms.premiumPerContract * numContracts;
        if (msg.value < totalPremium)
            revert AssetTypes.InvalidParameter("insufficient premium");

        (int256 currentPrice, , ) = priceOracle.getLatestPrice(
            optionsTerms.priceId
        );

        uint256 positionId = _openPosition(
            msg.sender,
            true, // buyers are always "long"
            numContracts,
            msg.value,
            uint256(currentPrice)
        );
        totalOptionsBought += numContracts;

        emit OptionBought(positionId, msg.sender, numContracts, totalPremium);
    }

    function exercise(
        uint256 positionId
    ) external nonReentrant {
        if (block.timestamp > optionsTerms.expirationDate)
            revert AssetTypes.ContractExpired();

        Position storage pos = positions[positionId];
        if (!pos.active) revert AssetTypes.InvalidParameter("not active");
        if (pos.holder != msg.sender) revert AssetTypes.Unauthorized();

        (int256 currentPrice, , ) = priceOracle.getLatestPrice(
            optionsTerms.priceId
        );

        uint256 payout = _calculateExercisePayout(
            pos.size,
            uint256(currentPrice)
        );
        if (payout == 0)
            revert AssetTypes.InvalidParameter("out of the money");

        pos.active = false;
        totalOptionsBought -= pos.size;

        if (payout > address(this).balance) payout = address(this).balance;

        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        if (!sent) revert AssetTypes.InsufficientFunds();

        emit OptionExercised(positionId, msg.sender, payout);
    }

    function expireWorthless() external onlyRole(OPERATOR_ROLE) {
        if (block.timestamp < optionsTerms.expirationDate)
            revert AssetTypes.ContractNotExpired();

        state = AssetTypes.DerivativeState.EXPIRED;
        emit OptionsExpired(block.timestamp);
    }

    function withdrawCollateral() external nonReentrant {
        if (state != AssetTypes.DerivativeState.EXPIRED)
            revert AssetTypes.AssetNotActive();

        uint256 amount = writerCollateral[msg.sender];
        if (amount == 0) revert AssetTypes.InvalidParameter("no collateral");

        writerCollateral[msg.sender] = 0;
        totalCollateral -= amount;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert AssetTypes.InsufficientFunds();
    }

    function isInTheMoney() external view returns (bool) {
        (int256 currentPrice, , ) = priceOracle.getLatestPrice(
            optionsTerms.priceId
        );
        uint256 price = uint256(currentPrice);

        if (optionsTerms.optionType == AssetTypes.OptionType.CALL) {
            return price > optionsTerms.strikePrice;
        } else {
            return price < optionsTerms.strikePrice;
        }
    }

    function intrinsicValue() external view returns (uint256) {
        (int256 currentPrice, , ) = priceOracle.getLatestPrice(
            optionsTerms.priceId
        );
        return
            _calculateIntrinsicValue(uint256(currentPrice)) *
            optionsTerms.contractSize;
    }

    function _calculateIntrinsicValue(
        uint256 currentPrice
    ) internal view returns (uint256) {
        if (optionsTerms.optionType == AssetTypes.OptionType.CALL) {
            return
                currentPrice > optionsTerms.strikePrice
                    ? currentPrice - optionsTerms.strikePrice
                    : 0;
        } else {
            return
                optionsTerms.strikePrice > currentPrice
                    ? optionsTerms.strikePrice - currentPrice
                    : 0;
        }
    }

    function _calculateExercisePayout(
        uint256 numContracts,
        uint256 currentPrice
    ) internal view returns (uint256) {
        uint256 iv = _calculateIntrinsicValue(currentPrice);
        return iv * numContracts * optionsTerms.contractSize;
    }

    function isExpired() external view returns (bool) {
        return block.timestamp >= optionsTerms.expirationDate;
    }
}
