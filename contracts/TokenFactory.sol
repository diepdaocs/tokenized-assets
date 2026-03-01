// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract TokenFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    address public equityImplementation;
    address public bondImplementation;
    address public derivativeImplementation;
    address public realEstateImplementation;

    event TokenCreated(address indexed tokenAddress, string assetType, string symbol);
    event RealEstateCreated(address indexed tokenAddress, string name, string symbol);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _equityImpl,
        address _bondImpl,
        address _derivativeImpl,
        address _realEstateImpl,
        address initialOwner
    ) initializer public {
        __Ownable_init(initialOwner);


        equityImplementation = _equityImpl;
        bondImplementation = _bondImpl;
        derivativeImplementation = _derivativeImpl;
        realEstateImplementation = _realEstateImpl;
    }

    function setImplementations(
        address _equityImpl,
        address _bondImpl,
        address _derivativeImpl,
        address _realEstateImpl
    ) external onlyOwner {
        equityImplementation = _equityImpl;
        bondImplementation = _bondImpl;
        derivativeImplementation = _derivativeImpl;
        realEstateImplementation = _realEstateImpl;
    }

    function createEquity(
        string memory name,
        string memory symbol,
        uint256 totalShares
    ) external returns (address) {
        require(equityImplementation != address(0), "Implementation not set");

        bytes memory initData = abi.encodeWithSignature(
            "initialize(string,string,uint256,address)",
            name,
            symbol,
            totalShares,
            msg.sender
        );

        address proxy = address(new ERC1967Proxy(equityImplementation, initData));
        emit TokenCreated(proxy, "Equity", symbol);
        return proxy;
    }

    function createBond(
        string memory name,
        string memory symbol,
        uint256 faceValue,
        uint256 couponRate,
        uint256 maturityDate,
        uint256 couponFrequency
    ) external returns (address) {
        require(bondImplementation != address(0), "Implementation not set");

        bytes memory initData = abi.encodeWithSignature(
            "initialize(string,string,uint256,uint256,uint256,uint256,address)",
            name,
            symbol,
            faceValue,
            couponRate,
            maturityDate,
            couponFrequency,
            msg.sender
        );

        address proxy = address(new ERC1967Proxy(bondImplementation, initData));
        emit TokenCreated(proxy, "Bond", symbol);
        return proxy;
    }

    function createDerivative(
        string memory uri
    ) external returns (address) {
        require(derivativeImplementation != address(0), "Implementation not set");

        bytes memory initData = abi.encodeWithSignature(
            "initialize(string,address)",
            uri,
            msg.sender
        );

        address proxy = address(new ERC1967Proxy(derivativeImplementation, initData));
        emit TokenCreated(proxy, "Derivative", "DERIVATIVE");
        return proxy;
    }

    function createRealEstate(
        string memory name,
        string memory symbol
    ) external returns (address) {
        require(realEstateImplementation != address(0), "Implementation not set");

        bytes memory initData = abi.encodeWithSignature(
            "initialize(string,string,address)",
            name,
            symbol,
            msg.sender
        );

        address proxy = address(new ERC1967Proxy(realEstateImplementation, initData));
        emit RealEstateCreated(proxy, name, symbol);
        return proxy;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}
