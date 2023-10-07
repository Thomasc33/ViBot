module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Using query parameters is highly favorable over embeding arguments through template strings.'
        },
        messages: {
            invalidQueryArguments: 'Database queries require at least a query parameter',
            noTemplateStrings: 'Database queries should use query parameters over template strings',
            noStringConcatenation: 'Database queries should use query parameters over string concatenation'
        },
        schema: []
    },
    create(context) {
        return {
            CallExpression(node) {

                if (node.callee.property?.name !== 'query') return
                if (!node.arguments.length) return context.report({ node, messageId: 'invalidQueryArguments' })

                const query = node.arguments[0]
                if (query.type == 'TemplateLiteral') context.report({ node, messageId: 'noTemplateStrings' })
                if (query.type == 'BinaryExpression') context.report({ node, messageId: 'noStringConcatenation' })
            }
        }
    }
}
