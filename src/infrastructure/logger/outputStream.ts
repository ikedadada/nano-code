export const outputStream = {
  write(text: string): void {
    process.stdout.write(text)
  },
}
