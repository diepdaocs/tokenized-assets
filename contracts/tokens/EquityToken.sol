// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../core/BaseAssetToken.sol";
import "../libraries/AssetTypes.sol";

contract EquityToken is BaseAssetToken {
    // Snapshot mechanism
    uint256 private _currentSnapshotId;
    mapping(uint256 => uint256) private _snapshotTotalSupply;
    mapping(uint256 => mapping(address => uint256))
        private _snapshotBalances;
    mapping(uint256 => mapping(address => bool))
        private _snapshotBalanceSet;

    // Dividends
    AssetTypes.DividendCheckpoint[] public dividendCheckpoints;
    mapping(uint256 => mapping(address => bool)) public dividendClaimed;

    // Voting
    mapping(address => address) public voteDelegates;

    // Equity metadata
    string public cusip;
    uint256 public totalShares;

    event SnapshotCreated(uint256 indexed snapshotId);
    event DividendDistributed(
        uint256 indexed checkpointIndex,
        uint256 snapshotId,
        uint256 amount
    );
    event DividendClaimed(
        uint256 indexed checkpointIndex,
        address indexed holder,
        uint256 amount
    );
    event VoteDelegated(
        address indexed delegator,
        address indexed delegatee
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address registry,
        address oracle,
        address issuer_,
        string memory cusip_,
        uint256 totalShares_
    ) public initializer {
        __BaseAssetToken_init(
            name_,
            symbol_,
            registry,
            oracle,
            AssetTypes.AssetCategory.EQUITY,
            issuer_
        );
        cusip = cusip_;
        totalShares = totalShares_;
    }

    function snapshot() external onlyRole(ISSUER_ROLE) returns (uint256) {
        _currentSnapshotId++;
        _snapshotTotalSupply[_currentSnapshotId] = totalSupply();
        emit SnapshotCreated(_currentSnapshotId);
        return _currentSnapshotId;
    }

    function distributeDividend(
        uint256 snapshotId
    ) external payable onlyRole(ISSUER_ROLE) {
        if (msg.value == 0) revert AssetTypes.InvalidParameter("amount");
        if (snapshotId == 0 || snapshotId > _currentSnapshotId)
            revert AssetTypes.InvalidParameter("snapshotId");
        if (_snapshotTotalSupply[snapshotId] == 0)
            revert AssetTypes.InvalidParameter("no supply at snapshot");

        dividendCheckpoints.push(
            AssetTypes.DividendCheckpoint({
                snapshotId: snapshotId,
                totalAmount: msg.value,
                claimedAmount: 0,
                blockTimestamp: block.timestamp
            })
        );

        emit DividendDistributed(
            dividendCheckpoints.length - 1,
            snapshotId,
            msg.value
        );
    }

    function claimDividend(uint256 checkpointIndex) external nonReentrant {
        if (checkpointIndex >= dividendCheckpoints.length)
            revert AssetTypes.InvalidParameter("checkpointIndex");
        if (dividendClaimed[checkpointIndex][msg.sender])
            revert AssetTypes.AlreadyClaimed();

        AssetTypes.DividendCheckpoint storage cp = dividendCheckpoints[
            checkpointIndex
        ];

        uint256 balance = balanceAtSnapshot(msg.sender, cp.snapshotId);
        uint256 supply = _snapshotTotalSupply[cp.snapshotId];

        if (balance == 0 || supply == 0)
            revert AssetTypes.InvalidParameter("no balance at snapshot");

        uint256 payout = (cp.totalAmount * balance) / supply;

        dividendClaimed[checkpointIndex][msg.sender] = true;
        cp.claimedAmount += payout;

        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        if (!sent) revert AssetTypes.InsufficientFunds();

        emit DividendClaimed(checkpointIndex, msg.sender, payout);
    }

    function delegateVotes(address delegatee) external {
        if (delegatee == address(0))
            revert AssetTypes.InvalidParameter("delegatee");
        voteDelegates[msg.sender] = delegatee;
        emit VoteDelegated(msg.sender, delegatee);
    }

    function getVotingPower(
        address account,
        uint256 snapshotId
    ) external view returns (uint256) {
        uint256 ownBalance = balanceAtSnapshot(account, snapshotId);
        return ownBalance;
    }

    function balanceAtSnapshot(
        address account,
        uint256 snapshotId
    ) public view returns (uint256) {
        if (_snapshotBalanceSet[snapshotId][account]) {
            return _snapshotBalances[snapshotId][account];
        }
        return balanceOf(account);
    }

    function currentSnapshotId() external view returns (uint256) {
        return _currentSnapshotId;
    }

    function dividendCheckpointCount() external view returns (uint256) {
        return dividendCheckpoints.length;
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Record snapshot balances before transfer
        if (_currentSnapshotId > 0) {
            if (from != address(0) && !_snapshotBalanceSet[_currentSnapshotId][from]) {
                _snapshotBalances[_currentSnapshotId][from] = balanceOf(from);
                _snapshotBalanceSet[_currentSnapshotId][from] = true;
            }
            if (to != address(0) && !_snapshotBalanceSet[_currentSnapshotId][to]) {
                _snapshotBalances[_currentSnapshotId][to] = balanceOf(to);
                _snapshotBalanceSet[_currentSnapshotId][to] = true;
            }
        }

        super._update(from, to, value);
    }
}
