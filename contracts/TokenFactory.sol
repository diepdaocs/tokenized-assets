// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenFactory is Ownable {
    address public equityImplementation;
    address public bondImplementation;
    address public derivativeImplementation;
    address public landImplementation;

    address[] public allAssets;

    event AssetDeployed(address indexed proxy, string assetType);

    constructor(
        address _equityImpl,
        address _bondImpl,
        address _derivativeImpl,
        address _landImpl
    ) Ownable(msg.sender) {
        equityImplementation = _equityImpl;
        bondImplementation = _bondImpl;
        derivativeImplementation = _derivativeImpl;
        landImplementation = _landImpl;
    }

    function updateImplementations(
        address _equityImpl,
        address _bondImpl,
        address _derivativeImpl,
        address _landImpl
    ) external onlyOwner {
        equityImplementation = _equityImpl;
        bondImplementation = _bondImpl;
        derivativeImplementation = _derivativeImpl;
        landImplementation = _landImpl;
    }

    function deployEquity(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(string,string,uint256,address)",
            name, symbol, initialSupply, msg.sender
        );
        ERC1967Proxy proxy = new ERC1967Proxy(equityImplementation, data);
        allAssets.push(address(proxy));
        emit AssetDeployed(address(proxy), "EQUITY");
        return address(proxy);
    }

    function deployBond(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 couponRate,
        uint256 maturityDate,
        uint256 couponFrequency
    ) external returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(string,string,uint256,uint256,uint256,uint256,address)",
            name, symbol, initialSupply, couponRate, maturityDate, couponFrequency, msg.sender
        );
        ERC1967Proxy proxy = new ERC1967Proxy(bondImplementation, data);
        allAssets.push(address(proxy));
        emit AssetDeployed(address(proxy), "BOND");
        return address(proxy);
    }

    function deployDerivative(string memory uri) external returns (address) {
        bytes memory data = abi.encodeWithSignature("initialize(string,address)", uri, msg.sender);
        ERC1967Proxy proxy = new ERC1967Proxy(derivativeImplementation, data);
        allAssets.push(address(proxy));
        emit AssetDeployed(address(proxy), "DERIVATIVE");
        return address(proxy);
    }

    function deployLand(string memory uri) external returns (address) {
        bytes memory data = abi.encodeWithSignature("initialize(string,address)", uri, msg.sender);
        ERC1967Proxy proxy = new ERC1967Proxy(landImplementation, data);
        allAssets.push(address(proxy));
        emit AssetDeployed(address(proxy), "LAND");
        return address(proxy);
    }

    function getAllAssets() external view returns (address[] memory) {
        return allAssets;
    }
}
