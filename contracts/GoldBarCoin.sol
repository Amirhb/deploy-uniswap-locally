// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GoldBarCoin is ERC20, Ownable {
    constructor() ERC20('GoldBarCoin', 'GBC') {}
}
