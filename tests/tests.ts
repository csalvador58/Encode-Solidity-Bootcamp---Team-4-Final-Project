import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  DiplomaNFT,
  DiplomaNFT__factory,
  MarkingToken,
  MarkingToken__factory,
  MyGovernor,
  MyGovernor__factory,
} from '../typechain-types';

const VOTES_QUORUM = 1;
const MARKING_TOKEN_MINT = ethers.utils.parseEther('10');

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

describe('Diploma DAO Project', async function () {
  let markingTokenContract: MarkingToken;
  let diplomaNFTContract: DiplomaNFT;
  let governorContract: MyGovernor;
  let deployer: SignerWithAddress;
  let student1: SignerWithAddress;
  let student2: SignerWithAddress;
  let student3: SignerWithAddress;

  beforeEach(async function () {
    // setup accounts
    [deployer, student1, student2, student3] = await ethers.getSigners();
    console.log('Deployer address: ');
    console.log(deployer.address);

    // Deploy Contracts
    const markingTokenCF = new MarkingToken__factory(deployer);
    markingTokenContract = await markingTokenCF.deploy();
    const markingTokenCTx = await markingTokenContract.deployTransaction.wait();
    console.log(`
    Marking Token contract deployed:
    address: ${markingTokenCTx.contractAddress}
    block: ${markingTokenCTx.blockNumber}`);

    const diplomaNFTCF = new DiplomaNFT__factory(deployer);
    diplomaNFTContract = await diplomaNFTCF.deploy();
    const diplomaNFTCTx = await diplomaNFTContract.deployTransaction.wait();
    console.log(`
    Diploma NFT contract deployed:
    address: ${diplomaNFTCTx.contractAddress}
    block: ${diplomaNFTCTx.blockNumber}`);

    const governorCF = new MyGovernor__factory(deployer);
    governorContract = await governorCF.deploy(
      markingTokenContract.address,
      VOTES_QUORUM,
      deployer.address
    );
    const governorCTx = await governorContract.deployTransaction.wait();
    console.log(`
    Governor contract deployed:
    address: ${governorCTx.contractAddress}
    block: ${governorCTx.blockNumber}`);
  });

  describe('when a new student is connected to Diploma DAO', async function () {
    it('has the marking token balance', async function () {
      console.log('Student address: ');
      console.log(student1.address);

      const student1Tokens = await markingTokenContract.balanceOf(
        student1.address
      );
      console.log('Student 1 Marking Token balance: ');
      console.log(student1Tokens);
      expect(student1Tokens).to.equal(0);
    });
  });

  describe('when the student requests tokens', async function () {
    it('increases the marking token balance', async function () {
      const tokenBalanceBeforeMint = await markingTokenContract.balanceOf(
        student1.address
      );
      const mintTx = await markingTokenContract.mint(
        student1.address,
        MARKING_TOKEN_MINT
      );
      const tokenBalanceAfterMint = await markingTokenContract.balanceOf(
        student1.address
      );
      const diff = tokenBalanceAfterMint.sub(
        MARKING_TOKEN_MINT.add(tokenBalanceBeforeMint)
      );
      console.log(`
      Token balance before mint: ${ethers.utils.formatEther(
        tokenBalanceBeforeMint
      )}
      Mint value: ${ethers.utils.formatEther(MARKING_TOKEN_MINT)}
      Token balance after mint: ${ethers.utils.formatEther(
        tokenBalanceAfterMint
      )}
      `);
      console.log(`Diff: ${diff}`);
      expect(diff).to.equal(0);
    });
  });

  describe('when the student submits a project', async function () {
    it('stores/displays project ID, URL/IPFS, and project status ', async function () {
      // code here
    });

  //   it('fails if no URL/IPFS Hash is entered', async function () {
  //     // code here
  //   });

  //   it('fails if marking token balance is zero', async function () {
  //     // code here
  //   });

  //   it('will allow student to mint a Diploma NFT if their project status has received required number of passes', async function () {
  //     // code here
  //   });
  // });

  // describe.skip('when a student views the Cohort section', async function () {
  //   it('should list all available projects sorted by ???', async function () {
  //     // code here
  //   });

  //   it('should list only open projects when toggle/switch is set to OPEN', async function () {
  //     // code here
  //   });
  //   it('should list only closed projects when toggle/switch is set to CLOSED', async function () {
  //     // code here
  //   });

  //   it('should register a passing vote if a student enters a project ID in the form field and triggers vote transaction', async function () {
  //     // code here
  //   });
  // });
});
