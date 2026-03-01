// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "./AssetBase.sol";

interface IAggregatorV3 {
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract DerivativeToken is ERC1155Upgradeable, AssetBase {
    struct Derivative {
        string name;
        address underlyingAsset;
        uint256 strikePrice;
        uint256 expiry;
        bool settled;
        address priceFeed;
    }

    mapping(uint256 => Derivative) public derivatives;
    uint256 public nextId;

    event DerivativeCreated(uint256 indexed id, string name, uint256 strikePrice, uint256 expiry);
    event Settled(uint256 indexed id, int256 finalPrice);

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

    function createDerivative(
        string memory name,
        address underlying,
        uint256 strikePrice,
        uint256 expiry,
        address priceFeed
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        uint256 id = nextId++;
        derivatives[id] = Derivative(name, underlying, strikePrice, expiry, false, priceFeed);
        emit DerivativeCreated(id, name, strikePrice, expiry);
        return id;
    }

    function mint(address to, uint256 id, uint256 amount, bytes memory data) external onlyRole(ISSUER_ROLE) {
        require(id < nextId, "Derivative: ID does not exist");
        _mint(to, id, amount, data);
    }

    function settle(uint256 id) external {
        Derivative storage d = derivatives[id];
        require(block.timestamp >= d.expiry, "Derivative: not yet expired");
        require(!d.settled, "Derivative: already settled");

        // Fetch price from Chainlink oracle
        (, int256 price, , , ) = IAggregatorV3(d.priceFeed).latestRoundData();
        
        d.settled = true;
        emit Settled(id, price);
        // Settlement logic based on price and strike...
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155Upgradeable) whenNotPaused {
        if (from != address(0) && to != address(0)) {
            require(whitelist[from], "DerivativeToken: sender not whitelisted");
            require(whitelist[to], "DerivativeToken: receiver not whitelisted");
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155Upgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
