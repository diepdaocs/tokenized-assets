// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/AssetTypes.sol";

interface IComplianceRegistry {
    event InvestorWhitelisted(address indexed investor, uint256 timestamp);
    event InvestorBlacklisted(address indexed investor, string reason);
    event InvestorStatusUpdated(
        address indexed investor,
        AssetTypes.InvestorStatus status
    );
    event AccreditedStatusChanged(
        address indexed investor,
        bool status,
        uint256 expiryDate
    );

    function isWhitelisted(address investor) external view returns (bool);
    function isBlacklisted(address investor) external view returns (bool);
    function isAccredited(address investor) external view returns (bool);
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);
    function getInvestorStatus(
        address investor
    ) external view returns (AssetTypes.InvestorStatus);
    function whitelistInvestor(address investor) external;
    function blacklistInvestor(
        address investor,
        string calldata reason
    ) external;
    function removeFromBlacklist(address investor) external;
    function setAccreditedStatus(
        address investor,
        bool status,
        uint256 expiryDate
    ) external;
    function batchWhitelist(address[] calldata investors) external;
}
