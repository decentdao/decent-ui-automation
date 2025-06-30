export const testDaos = {
  ERC20: {
    network: 'sep',
    address: '0xB4b01b4Dc5f8d11feD90D760a237BF4D74C3423d',
    get value(): string { return `${this.network}:${this.address}`; }
  },
  ERC721: {
    network: 'sep',
    address: '0x0BB34D2e76099c72dD26665afE5710980E271382',
    get value(): string { return `${this.network}:${this.address}`; }
  },
  multisig: {
    network: 'sep',
    address: '0x0B17fd112dc1B25892e7E85D486dD390A037936A',
    get value(): string { return `${this.network}:${this.address}`; }
  }
};
