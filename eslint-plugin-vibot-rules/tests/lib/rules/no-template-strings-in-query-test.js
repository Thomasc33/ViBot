'use strict';

const { RuleTester } = require('eslint');
const rule = require('../../../lib/rules/no-template-strings-in-query')

const ruleTester = new RuleTester()

ruleTester.run("no-template-strings-in-query", rule, {
    valid: [
        {
            code: 'db.query(\'This is a test query\', [1])',
            options: []
        }
    ],
    invalid: [
        {
            code: 'db.query()',
            errors: [{ messageId: 'invalidQueryArguments' }]
        },
        {
            code: 'db.query(`This is a template query ${c}`)',
            errors: [{ messageId: 'noTemplateStrings' }],
            parserOptions: { ecmaVersion: 6 }
        },
        {
            code: 'db.query(\'This is a \' + \'concatenated string\')',
            errors: [{ messageId: 'noStringConcatenation' }]
        }
    ]
})