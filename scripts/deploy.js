const { Contract, ContractFactory, utils, BigNumber } = require('ethers');
const WETH9 = require('../bytecodes/WETH9.json');
const bn = require('bignumber.js');

const artifacts  = {
    UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
    SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
    NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
    NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
    NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
    WETH9,
};

const UniswapV3Pool = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3pool.json");

const linkLibraries = (
    {
      bytecode,
      linkReferences,
    },
    libraries
  ) => {
    Object.keys(linkReferences).forEach((fileName) => {
      Object.keys(linkReferences[fileName]).forEach((contractName) => {
        if (!libraries.hasOwnProperty(contractName)) {
          throw new Error(`Missing link library name ${contractName}`)
        }
        const address = utils
          .getAddress(libraries[contractName])
          .toLowerCase()
          .slice(2)
        linkReferences[fileName][contractName].forEach(
          ({ start, length }) => {
            const start2 = 2 + start * 2
            const length2 = length * 2
            bytecode = bytecode
              .slice(0, start2)
              .concat(address)
              .concat(bytecode.slice(start2 + length2, bytecode.length))
          }
        )
      })
    })
    return bytecode
  }

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

// returns the sqrt price as a 64x96
function encodePriceSqrt(reserve1, reserve0) {
    return BigNumber.from(
        new bn(reserve1.toString())
        .div(reserve0.toString())
        .sqrt()
        .multipliedBy(new bn(2).pow(96))
        .integerValue(3)
        .toString()
    )
}

async function main() {
    const [owner, signer2] = await ethers.getSigners();
    const provider = waffle.provider;

    Weth = new ContractFactory(artifacts.WETH9.abi, artifacts.WETH9.bytecode, owner);
    weth = await Weth.deploy();
    console.log(`weth: ${weth.address}`);

    GoldBarCoin = await ethers.getContractFactory('GoldBarCoin', owner);
    goldBarCoin = await GoldBarCoin.deploy();
    console.log(`goldBarCoin: ${goldBarCoin.address}`);

    Factory = new ContractFactory(artifacts.UniswapV3Factory.abi, artifacts.UniswapV3Factory.bytecode, owner);
    factory = await Factory.deploy();
    console.log(`factory: ${factory.address}`);

    SwapRouter = new ContractFactory(artifacts.SwapRouter.abi, artifacts.SwapRouter.bytecode, owner);
    swapRouter = await SwapRouter.deploy(factory.address, weth.address);
    console.log(`swapRouter: ${swapRouter.address}`);

    NFTDescriptor = new ContractFactory(artifacts.NFTDescriptor.abi, artifacts.NFTDescriptor.bytecode, owner);
    nftDescriptor = await NFTDescriptor.deploy();
    console.log(`nftDescriptor: ${nftDescriptor.address}`);

    const linkedBytecode = linkLibraries(
        {
          bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
          linkReferences: {
            "NFTDescriptor.sol": {
              NFTDescriptor: [
                {
                  length: 20,
                  start: 1261,
                },
              ],
            },
          },
        },
        {
          NFTDescriptor: nftDescriptor.address,
        }
      );

    NonfungibleTokenPositionDescriptor = new ContractFactory(artifacts.NonfungibleTokenPositionDescriptor.abi, linkedBytecode, owner);
    nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor.deploy(weth.address);
    console.log(`nonfungibleTokenPositionDescriptor: ${nonfungibleTokenPositionDescriptor.address}`);

    NonfungiblePositionManager = new ContractFactory(artifacts.NonfungiblePositionManager.abi, artifacts.NonfungiblePositionManager.bytecode, owner);
    nonfungiblePositionManager = await NonfungiblePositionManager.deploy(factory.address, weth.address, nonfungibleTokenPositionDescriptor.address);
    console.log(`nonfungiblePositionManager: ${nonfungiblePositionManager.address}`);

    const sqrtPrice = encodePriceSqrt(1, 1);
    await nonfungiblePositionManager.connect(owner).createAndInitializePoolIfNecessary(
        weth.address,
        goldBarCoin.address,
        500,
        sqrtPrice,
        {gasLimit: 5000000}
    );

    const poolAddress = await factory.connect(owner).getPool(
        weth.address,
        goldBarCoin.address,
        500
    );

    const pool = new Contract(
        poolAddress,
        UniswapV3Pool.abi,
        provider
    );

    console.log(`fee: ${await pool.fee()}`);
    console.log(`slot0: ${await pool.slot0()}`);
    console.log(`liquidity: ${await pool.liquidity()}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
