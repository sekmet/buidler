# 7. Deploying to a live network
Once you're ready to share your dApp with other people what you may want to do is deploy to a live network. This way others can access an instance that's not running locally on your system. 

There's the Ethereum network that deals with real money which is called "mainnet", and then there are other live networks that don't deal with real money but do mimic the real world scenario well, and can be used by others as a shared staging environment. These are called "testnets" and Ethereum has multiple ones: *Ropsten*, *Kovan*, *Rinkeby* and *Goerli*. We recommend you deploy your contracts to the *Ropsten* testnet.

At the software level, deploying to a testnet is the same as deploying to mainnet. The only difference is which network you connect to. Let's look into what the code to deploy your contracts using ethers.js would look like.

The main concepts used are `Signer`, `ContractFactory` and `Contract` which we explained back in the [testing](testing-contracts.md) section. There's nothing new that needs to be done when compared to testing, given that when you're testing your contracts you're *actually* making a deployment to your development network. This makes the code very similar, or the same.

Let's create a new directory `scripts` inside the project root's directory, and paste the following into a `deploy.js` file:

```js
async function main() {

  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );
  
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy();

  await token.deployed();

  console.log("Token address:", token.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
```

To indicate **Buidler** to connect to a specific Ethereum network when running any tasks, you can use the `--network` parameter. Like this:

```
npx buidler run scripts/deploy.js --network <network-name>
```

In this case, running it without the `--network` parameter would get the code to run against an embedded instance of **Buidler EVM**, so the deployment actually gets lost when **Buidler** finishes running, but it's still useful to test that our deployment code works:

```
$ npx buidler run scripts/deploy.js
All contracts have already been compiled, skipping compilation.
Deploying contracts with the account: 0xc783df8a850f42e7F7e57013759C285caa701eB6
Account balance: 10000000000000000000000
Token address: 0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F
```

## Deploying to remote networks
To deploy to a remote network such as mainnet or any testnet, you need to add a `network` entry to your `buidler.config.js` file. We’ll use Ropsten for this example, but you can add any network similarly:

```js{5,11,14-19}
usePlugin("@nomiclabs/buidler-waffle");

// Go to https://infura.io/ and create a new project
// Replace this with your Infura project ID
const INFURA_PROJECT_ID = "YOUR INFURA PROJECT ID";

// Replace this private key with your Ropsten account private key
// To export your private key from Metamask, open Metamask and
// go to Account Details > Export Private Key
// Be aware of NEVER putting real Ether into testing accounts
const ROPSTEN_PRIVATE_KEY = "YOUR ROPSTEN PRIVATE KEY";

module.exports = {
  networks: {
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`]
    }
  }
};
```
We're using [Infura](https://infura.io/), but pointing `url` to any Ethereum node or gateway would work. Go grab your `INFURA_PROJECT_ID` and come back.

To deploy on Ropsten you need to send ropsten-ETH into the address that's going to be making the deployment. You can get some ETH for testnets from a faucet, a service that distributes testing-ETH for free. [Here's the one for Ropsten](https://faucet.metamask.io/), you'll have to change Metamask's network to Ropsten before transacting. 

::: tip
You can get some ETH for other testnets following these links: 

* [Kovan faucet](https://faucet.kovan.network/)
* [Rinkeby faucet](https://faucet.rinkeby.io/)
* [Goerli faucet](https://goerli-faucet.slock.it/)
:::

Finally, run:
```
npx buidler run scripts/deploy.js --network ropsten
```

If everything went well, you should see the deployed contract address.

