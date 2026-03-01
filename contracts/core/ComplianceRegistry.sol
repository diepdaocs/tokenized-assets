// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../libraries/AssetTypes.sol";

contract ComplianceRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IComplianceRegistry
{
    bytes32 public constant COMPLIANCE_OFFICER_ROLE =
        keccak256("COMPLIANCE_OFFICER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    mapping(address => AssetTypes.InvestorStatus) private _investorStatus;
    mapping(address => bool) private _accreditedInvestors;
    mapping(address => uint256) private _accreditedExpiry;
    mapping(address => string) private _blacklistReasons;
    uint256 private _whitelistedCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();


        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_OFFICER_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    function whitelistInvestor(
        address investor
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        if (investor == address(0))
            revert AssetTypes.InvalidParameter("investor");

        _investorStatus[investor] = AssetTypes.InvestorStatus.WHITELISTED;
        _whitelistedCount++;

        emit InvestorWhitelisted(investor, block.timestamp);
        emit InvestorStatusUpdated(
            investor,
            AssetTypes.InvestorStatus.WHITELISTED
        );
    }

    function blacklistInvestor(
        address investor,
        string calldata reason
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        if (investor == address(0))
            revert AssetTypes.InvalidParameter("investor");

        if (_investorStatus[investor] == AssetTypes.InvestorStatus.WHITELISTED) {
            _whitelistedCount--;
        }

        _investorStatus[investor] = AssetTypes.InvestorStatus.BLACKLISTED;
        _blacklistReasons[investor] = reason;

        emit InvestorBlacklisted(investor, reason);
        emit InvestorStatusUpdated(
            investor,
            AssetTypes.InvestorStatus.BLACKLISTED
        );
    }

    function removeFromBlacklist(
        address investor
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        if (investor == address(0))
            revert AssetTypes.InvalidParameter("investor");

        _investorStatus[investor] = AssetTypes.InvestorStatus.NONE;
        delete _blacklistReasons[investor];

        emit InvestorStatusUpdated(investor, AssetTypes.InvestorStatus.NONE);
    }

    function setAccreditedStatus(
        address investor,
        bool status,
        uint256 expiryDate
    ) external onlyRole(VERIFIER_ROLE) {
        if (investor == address(0))
            revert AssetTypes.InvalidParameter("investor");

        _accreditedInvestors[investor] = status;
        _accreditedExpiry[investor] = expiryDate;

        emit AccreditedStatusChanged(investor, status, expiryDate);
    }

    function batchWhitelist(
        address[] calldata investors
    ) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        for (uint256 i = 0; i < investors.length; i++) {
            if (investors[i] == address(0)) continue;

            _investorStatus[investors[i]] = AssetTypes
                .InvestorStatus
                .WHITELISTED;
            _whitelistedCount++;

            emit InvestorWhitelisted(investors[i], block.timestamp);
        }
    }

    function isWhitelisted(address investor) external view returns (bool) {
        return
            _investorStatus[investor] ==
            AssetTypes.InvestorStatus.WHITELISTED;
    }

    function isBlacklisted(address investor) external view returns (bool) {
        return
            _investorStatus[investor] ==
            AssetTypes.InvestorStatus.BLACKLISTED;
    }

    function isAccredited(address investor) external view returns (bool) {
        return
            _accreditedInvestors[investor] &&
            block.timestamp <= _accreditedExpiry[investor];
    }

    function canTransfer(
        address from,
        address to,
        uint256 /* amount */
    ) external view returns (bool) {
        if (from == address(0) || to == address(0)) return true; // mint/burn
        return
            _investorStatus[from] ==
            AssetTypes.InvestorStatus.WHITELISTED &&
            _investorStatus[to] ==
            AssetTypes.InvestorStatus.WHITELISTED;
    }

    function getInvestorStatus(
        address investor
    ) external view returns (AssetTypes.InvestorStatus) {
        return _investorStatus[investor];
    }

    function getBlacklistReason(
        address investor
    ) external view returns (string memory) {
        return _blacklistReasons[investor];
    }

    function whitelistedCount() external view returns (uint256) {
        return _whitelistedCount;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
