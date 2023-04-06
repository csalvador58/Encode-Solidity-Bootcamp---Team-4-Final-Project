import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import {
    DiplomaGuildGov, 
    DiplomaGuildTimeLock, 
    MarkingToken,
    DiplomaGuildNFT,
} from "../typechain-types";
import { BigNumber, BigNumberish } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const MARKING_TOKEN_MINT = ethers.utils.parseEther('10');
const DIPLOMA_URI = "ipfs://bafkreihqfo2yd4o7fjveg5bptjgaobwqdd7nk7i7l7a6xmm5s25lrzabjm";
const PROJECT_URL = "https://github.com/w3ia/Encode-Solidity-Bootcamp---Team-4-Final-Project"

describe('Diploma DAO Project', async function () {
  async function setupAndDeployFixture() {
    // Setup accounts
    const [deployer, student1, student2] = await ethers.getSigners();

    // Deploy Marking Token contract
    const markingTokenCF = await ethers.getContractFactory("MarkingToken");
    const markingTokenC = await markingTokenCF.deploy();
    await markingTokenC.deployed();

    // Deploy Timelock contract
    const timelockCF = await ethers.getContractFactory("DiplomaGuildTimeLock");
    const timelockC = await timelockCF.deploy(0, [deployer.address], [deployer.address], deployer.address);
    await timelockC.deployed();

    // Deploy Governor contract:
    const govCF = await ethers.getContractFactory("DiplomaGuildGov"); 
    const govC = await govCF.deploy(markingTokenC.address, timelockC.address);
    await govC.deployed();

    // Assign Timelock roles to Governor
    await timelockC.grantRole(await timelockC.EXECUTOR_ROLE(), govC.address);
    await timelockC.grantRole(await timelockC.PROPOSER_ROLE(), govC.address);

    // Deploy NFT contract
    const diplomaGuildCF = await ethers.getContractFactory("DiplomaGuildNFT"); 
    const DiplomaGuildC = await diplomaGuildCF.deploy();
    await DiplomaGuildC.deployed();

    // Assign NFT roles to Timelock contract
    await DiplomaGuildC.grantRole(await DiplomaGuildC.MINTER_ROLE(), timelockC.address);
    await DiplomaGuildC.grantRole(await DiplomaGuildC.PAUSER_ROLE(), timelockC.address);

    return { deployer, student1, student2, markingTokenC, timelockC, govC, DiplomaGuildC }
  }

  async function mintMarkingTokens(address: string, markingToken: MarkingToken): Promise<BigNumber> {
    const mintTx = await markingToken.mint(address, MARKING_TOKEN_MINT);
    await mintTx.wait();
    return await markingToken.balanceOf(address);
  }

  async function delegate(delegator: SignerWithAddress, toAddress: string, markingToken: MarkingToken) {
    const delegateTx = await markingToken.connect(delegator).delegate(toAddress);
    await delegateTx.wait();
  }

  async function getVotingPower(address: string, markingToken: MarkingToken): Promise<BigNumber> {
    return await markingToken.getVotes(address);
  }

  async function submitProject(DiplomaGuildC: DiplomaGuildNFT, govC: DiplomaGuildGov, projectURL: string, studentAddress: string): 
  Promise<string> {
    const transferCalldata = DiplomaGuildC.interface.encodeFunctionData(`safeMint`, [studentAddress, DIPLOMA_URI]);

    const proposeTx = await govC.propose(
        [DiplomaGuildC.address],
        [0],
        [transferCalldata],
        projectURL,
      );
      
    const receipt = await proposeTx.wait();
    return (receipt.events?.[0]?.args?.proposalId).toString();
  }

  async function vote(voter: SignerWithAddress, propId: BigNumberish, govC: DiplomaGuildGov):
  Promise<any> {
    let voteTx = await govC.connect(voter).castVote(propId, 1);  
    await voteTx.wait();
    return await govC.state(propId);
  } 
// -------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------

  it('Student can request Marking Tokens', async function () {
    const { student1, markingTokenC} = await loadFixture(setupAndDeployFixture);
    let tokenBalanceAccount = await mintMarkingTokens(student1.address,markingTokenC);
    expect((tokenBalanceAccount)).to.equal(MARKING_TOKEN_MINT);
  });

  it('Student can delegate their Marking Tokens', async function () {
    const { student1, markingTokenC} = await loadFixture(setupAndDeployFixture);
    await mintMarkingTokens(student1.address,markingTokenC);
    await delegate(student1, student1.address, markingTokenC);
    const votePower = await getVotingPower(student1.address, markingTokenC);
    expect(votePower).to.equal(MARKING_TOKEN_MINT);
  });

  it('Student can submit their project for review/marking', async function () {
    const { student2, govC, DiplomaGuildC} = await loadFixture(setupAndDeployFixture);
    const transferCalldata = DiplomaGuildC.interface.encodeFunctionData(`safeMint`, [student2.address, DIPLOMA_URI]);
    const propID = submitProject(DiplomaGuildC, govC, PROJECT_URL, student2.address);
    expect(propID).not.be.undefined;
  });

  it('Student can mark (vote on) others project', async function () {
    const { student1, student2, markingTokenC, govC, DiplomaGuildC } = await loadFixture(setupAndDeployFixture);

    const mintTx = await markingTokenC.mint(student1.address, MARKING_TOKEN_MINT);
    await mintTx.wait();
    const delegateTx = await markingTokenC.connect(student1).delegate(student1.address);
    await delegateTx.wait();

    const transferCalldata = DiplomaGuildC.interface.encodeFunctionData(`safeMint`, [student2.address, DIPLOMA_URI]);
    const proposeTx = await govC.propose(
        [DiplomaGuildC.address],
        [0],
        [transferCalldata],
        PROJECT_URL,
      );
    const proposeTxReceipt = await proposeTx.wait();
    const propID = proposeTxReceipt.events?.[0]?.args?.proposalId;

    const beforeAfterVote = await govC.state(propID.toString());
    expect(beforeAfterVote).to.equal(0);
    
    const voteTx = await govC.connect(student1).castVote(propID.toString(), 1);  
    await voteTx.wait();
 
    const stateAfterVote = await govC.state(propID.toString());
    expect(stateAfterVote).to.equal(1);
  });

  it('Project succesfully passes', async function () {
    const { student1, student2, markingTokenC, govC, DiplomaGuildC } = await loadFixture(setupAndDeployFixture);

    const mintTx = await markingTokenC.mint(student1.address, MARKING_TOKEN_MINT);
    await mintTx.wait();
    const delegateTx = await markingTokenC.connect(student1).delegate(student1.address);
    await delegateTx.wait();

    const transferCalldata = DiplomaGuildC.interface.encodeFunctionData(`safeMint`, [student2.address, DIPLOMA_URI]);
    const proposeTx = await govC.propose(
        [DiplomaGuildC.address],
        [0],
        [transferCalldata],
        PROJECT_URL,
      );
    const proposeTxReceipt = await proposeTx.wait();
    const propID = (proposeTxReceipt.events?.[0]?.args?.proposalId).toString();

    const beforeAfterVote = await govC.state(propID);
    expect(beforeAfterVote).to.equal(0);
    
    const voteTx = await govC.connect(student1).castVote(propID, 1);  
    await voteTx.wait();

    await mine(10);

    const stateAfterVote = await govC.state(propID);
    expect(stateAfterVote).to.equal(4);
  });

  it('Graduating student can mint their Diploma NFT', async function () {
    const { student1, student2, markingTokenC, govC, DiplomaGuildC } = await loadFixture(setupAndDeployFixture);

    const mintTx = await markingTokenC.mint(student1.address, MARKING_TOKEN_MINT);
    await mintTx.wait();
    const delegateTx = await markingTokenC.connect(student1).delegate(student1.address);
    await delegateTx.wait();

    const transferCalldata = DiplomaGuildC.interface.encodeFunctionData(`safeMint`, [student2.address, DIPLOMA_URI]);
    const proposeTx = await govC.propose(
        [DiplomaGuildC.address],
        [0],
        [transferCalldata],
        PROJECT_URL,
      );
    const proposeTxReceipt = await proposeTx.wait();
    const propID = (proposeTxReceipt.events?.[0]?.args?.proposalId).toString();

    const beforeAfterVote = await govC.state(propID);
    expect(beforeAfterVote).to.equal(0);
    
    const voteTx = await govC.connect(student1).castVote(propID, 1);  
    await voteTx.wait();

    await mine(10);

    const stateAfterVote = await govC.state(propID);
    expect(stateAfterVote).to.equal(4);

    let diplomaBalanceAccount = await DiplomaGuildC.balanceOf(student2.address);
    expect(ethers.utils.formatUnits(diplomaBalanceAccount, 0)).to.equal("0");

    const descriptionHash = ethers.utils.id(PROJECT_URL);

    const queueTx = await govC.queue(
      [DiplomaGuildC.address],
      [0],
      [transferCalldata],
      descriptionHash,
    );
    await queueTx.wait();

    const executeTx = await govC.execute(
      [DiplomaGuildC.address],
      [0],
      [transferCalldata],
      descriptionHash,
    );
    await executeTx.wait();
    
    diplomaBalanceAccount = await DiplomaGuildC.balanceOf(student2.address);
    expect(ethers.utils.formatUnits(diplomaBalanceAccount, 0)).to.equal("1");
  });
});