export function useWallet() {
  const formatAddress = (address: string | null): string => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return {
    formatAddress
  }
}
