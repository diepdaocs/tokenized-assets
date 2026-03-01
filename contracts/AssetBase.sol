// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

abstract contract AssetBase is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant TRADER_ROLE = keccak256("TRADER_ROLE");

    mapping(address => bool) public whitelist;
    bool public whitelistEnabled;

    event Whitelisted(address indexed account, bool isWhitelisted);
    event WhitelistToggled(bool enabled);

    function __AssetBase_init() internal onlyInitializing {
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        
        whitelistEnabled = true;
    }

    modifier onlyWhitelisted(address account) {
        if (whitelistEnabled) {
            require(whitelist[account], "AssetBase: account not whitelisted");
        }
        _;
    }

    function setWhitelisted(address account, bool isWhitelisted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelist[account] = isWhitelisted;
        emit Whitelisted(account, isWhitelisted);
    }

    function toggleWhitelist(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistEnabled = enabled;
        emit WhitelistToggled(enabled);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
