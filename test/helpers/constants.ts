import { ethers } from "hardhat";

export const ROLES = {
  DEFAULT_ADMIN: ethers.ZeroHash,
  ISSUER: ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE")),
  OPERATOR: ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE")),
  COMPLIANCE_OFFICER: ethers.keccak256(
    ethers.toUtf8Bytes("COMPLIANCE_OFFICER_ROLE")
  ),
  VERIFIER: ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE")),
  ORACLE_ADMIN: ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ADMIN_ROLE")),
  DEPLOYER: ethers.keccak256(ethers.toUtf8Bytes("DEPLOYER_ROLE")),
  REGISTRAR: ethers.keccak256(ethers.toUtf8Bytes("REGISTRAR_ROLE")),
};

export const ONE_DAY = 86400;
export const ONE_WEEK = ONE_DAY * 7;
export const ONE_MONTH = ONE_DAY * 30;
export const ONE_YEAR = ONE_DAY * 365;

export const DECIMALS_18 = ethers.parseEther("1");
export const BPS_BASE = 10000n;

export const MOCK_PRICE = 200000000000n; // $2000 with 8 decimals
export const MOCK_DECIMALS = 8;
export const STALENESS_THRESHOLD = 3600; // 1 hour
