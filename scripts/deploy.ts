import { network, artifacts } from "hardhat";
import { writeFileSync } from "node:fs";

const { ethers } = await network.getOrCreate();

const posts = await ethers.deployContract("Posts");
await posts.waitForDeployment();

const address = await posts.getAddress();
const artifact = await artifacts.readArtifact("Posts");

const output = { address, abi: artifact.abi };
writeFileSync("frontend/src/contract.json", JSON.stringify(output, null, 2) + "\n");

console.log("Posts deployed to", address);
