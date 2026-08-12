#!/bin/bash
echo "Publishing stew-ai to npm..."
echo "You need an npm account. Login first:"
echo "  npm login"
echo "Then run:"
echo "  npm publish --access public"
echo ""
echo "Or set NPM_TOKEN env var and run:"
echo "  NPM_TOKEN=your_token npm publish --access public --//registry.npmjs.org/:_authToken=\$NPM_TOKEN"
