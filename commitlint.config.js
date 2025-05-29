module.exports = {
    extends: ["@commitlint/config-conventional"],
    rules: {
        "type-enum": [2, "always", ["build", "chore", "docs", "feat", "fix", "refactor", "style", "test"]],
        "body-max-line-length": [0, "always"],
        "footer-max-line-length": [0, "always"],
    },
};
