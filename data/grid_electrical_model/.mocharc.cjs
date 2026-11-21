// Node (>=22.18) strips TypeScript types natively, so no ts-node/tsx is needed
module.exports = {
    extension: ["ts"],
    spec: ["src/**/*.test.ts"],
}
