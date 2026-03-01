// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "./AssetBase.sol";

contract LandToken is ERC1155Upgradeable, AssetBase {
    struct Land {
        string location;
        uint256 totalArea;
        uint256 valuation;
        bool exists;
    }

    mapping(uint256 => Land) public lands;
    uint256 public nextId;

    event LandRegistered(uint256 indexed id, string location, uint256 totalArea, uint256 valuation);
    event LandValuationUpdated(uint256 indexed id, uint256 newValuation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory uri, address admin) public initializer {
        __ERC1155_init(uri);
        __AssetBase_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function registerLand(
        string memory location,
        uint256 totalArea,
        uint256 initialValuation,
        uint256 fractionalSupply,
        address initialOwner
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        uint256 id = nextId++;
        lands[id] = Land(location, totalArea, initialValuation, true);
        
        _mint(initialOwner, id, fractionalSupply, "");
        
        emit LandRegistered(id, location, totalArea, initialValuation);
        return id;
    }

    function updateValuation(uint256 id, uint256 newValuation) external onlyRole(ISSUER_ROLE) {
        require(lands[id].exists, "LandToken: ID does not exist");
        lands[id].valuation = newValuation;
        emit LandValuationUpdated(id, newValuation);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155Upgradeable) whenNotPaused {
        if (from != address(0) && to != address(0)) {
            require(whitelist[from], "LandToken: sender not whitelisted");
            require(whitelist[to], "LandToken: receiver not whitelisted");
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155Upgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
