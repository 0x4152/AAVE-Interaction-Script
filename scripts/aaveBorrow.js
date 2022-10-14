const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("./getWeth")

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLendingPool(deployer)
    console.log(`lending pool address : ${lendingPool.address}`)
    const WETHTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    await approveERC20(WETHTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("depositing...")
    await lendingPool.deposit(WETHTokenAddress, AMOUNT, deployer, 0)
    console.log("deposited")

    //borrow
    //getUserAccountData(),
    let { availableBorrowsETH, totalDebtETH } = await getAAVEUserData(lendingPool, deployer)
    //how much DAI can we borrow?
    const DAIPrice = await getDAIPrice(deployer)
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / DAIPrice.toNumber())
    console.log(`Amound Dai to Borrow: ${amountDaiToBorrow}`)
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    console.log(`Amound Dai to Borrow WEI: ${amountDaiToBorrowWei}`)
    const DAITokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    await borrowDAI(DAITokenAddress, lendingPool, amountDaiToBorrowWei, deployer)
    await getAAVEUserData(lendingPool, deployer)
    await repay(amountDaiToBorrowWei, DAITokenAddress, lendingPool, deployer)
    await getAAVEUserData(lendingPool, deployer)
}
async function repay(amount, daiAddress, lendingPool, account) {
    await approveERC20(daiAddress, lendingPool.address, amount, account) //we have to approve the lending pool contract to send it back
    const rateMode = 1 //stable
    const repayTx = await lendingPool.repay(daiAddress, amount, rateMode, account)
}

async function borrowDAI(daiAddress, lendingPool, amountDaiToBorrowWEI, account) {
    console.log("borrowing...")
    //1 stable, 2 variable
    const borrowTX = await lendingPool.borrow(daiAddress, amountDaiToBorrowWEI, 1, 0, account)
    await borrowTX.wait(1)
    console.log(`You have borrowed ${ethers.utils.formatEther(amountDaiToBorrowWEI)} DAI`)
}

async function getDAIPrice(account) {
    //para crear el price feed necesitamos el interfaz del price feed, que son todos iguales, y el address del price feed especifico
    //de la pareja ETH/DAI, que se consigue en los docs de Chainlink
    const DAIPriceFeedAddress = "0x773616E4d11A78F511299002da57A0a94577F1f4"
    const DAIPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        DAIPriceFeedAddress,
        account
    ) //realmente podriamos no pasar el deployer, ya que solo estariamos reading from the contract
    const price = (await DAIPriceFeed.latestRoundData())[1]
    console.log(`price : ${price.toString()}`)
    return price
}
async function getAAVEUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`you have a total collateral of :${totalCollateralETH}`)
    console.log(`you have a total debt of :${totalDebtETH}`)
    console.log(`you are able to borrow a total of  :${availableBorrowsETH} eth`)

    return { availableBorrowsETH, totalDebtETH }
}
async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider2",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    //tenemos el lending Pool Address, pero queremos devolver el Lending Pool contract.
    const lendingPoolContract = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        account
    )
    return lendingPoolContract
}

async function approveERC20(ERC20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", ERC20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("Approved")
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
