// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../libraries/AssetTypes.sol";

contract LandToken is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    IComplianceRegistry public complianceRegistry;
    uint256 private _nextTokenId;

    mapping(uint256 => AssetTypes.LandProperty) private _properties;
    mapping(uint256 => address) public fractionalContracts;

    event LandMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string propertyId
    );
    event LandFractionalized(
        uint256 indexed tokenId,
        address indexed fractionalContract
    );
    event ValuationUpdated(uint256 indexed tokenId, uint256 newValuation);
    event ComplianceRegistryUpdated(address indexed newRegistry);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address registry,
        address admin
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __ERC721URIStorage_init();
        __AccessControl_init();


        complianceRegistry = IComplianceRegistry(registry);
        _nextTokenId = 1;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function mintProperty(
        address to,
        AssetTypes.LandProperty memory property,
        string memory tokenURI_
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        if (!complianceRegistry.isWhitelisted(to))
            revert AssetTypes.NotWhitelisted(to);
        if (bytes(property.propertyId).length == 0)
            revert AssetTypes.InvalidParameter("propertyId");

        uint256 tokenId = _nextTokenId++;
        property.fractionalized = false;
        _properties[tokenId] = property;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        emit LandMinted(tokenId, to, property.propertyId);
        return tokenId;
    }

    function fractionalize(
        uint256 tokenId,
        address fractionalContract
    ) external onlyRole(REGISTRAR_ROLE) {
        if (ownerOf(tokenId) == address(0))
            revert AssetTypes.InvalidParameter("tokenId");
        if (fractionalContract == address(0))
            revert AssetTypes.InvalidParameter("fractionalContract");
        if (_properties[tokenId].fractionalized)
            revert AssetTypes.InvalidParameter("already fractionalized");

        _properties[tokenId].fractionalized = true;
        fractionalContracts[tokenId] = fractionalContract;

        emit LandFractionalized(tokenId, fractionalContract);
    }

    function updateValuation(
        uint256 tokenId,
        uint256 newValuation
    ) external onlyRole(REGISTRAR_ROLE) {
        if (ownerOf(tokenId) == address(0))
            revert AssetTypes.InvalidParameter("tokenId");

        _properties[tokenId].valuationUsd = newValuation;
        emit ValuationUpdated(tokenId, newValuation);
    }

    function getProperty(
        uint256 tokenId
    ) external view returns (AssetTypes.LandProperty memory) {
        return _properties[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function setComplianceRegistry(
        address registry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registry == address(0))
            revert AssetTypes.InvalidParameter("registry");
        complianceRegistry = IComplianceRegistry(registry);
        emit ComplianceRegistryUpdated(registry);
    }

    // Override _update to enforce compliance on transfers
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721Upgradeable) returns (address) {
        address from = _ownerOf(tokenId);

        // Skip compliance check for minting (from == 0) and burning (to == 0)
        if (from != address(0) && to != address(0)) {
            if (!complianceRegistry.canTransfer(from, to, 1))
                revert AssetTypes.TransferRestricted(from, to);
        }

        return super._update(to, tokenId, auth);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
