var esprima = require('esprima'),
    escodegen = require('escodegen'),
    tosource = require('tosource')

module.exports = {
  fnToAst: fnToAst,
  isArrowFunctionThatImplicitlyReturns: isArrowFunctionThatImplicitlyReturns,
  bodyContainsOnlyOneStatement: bodyContainsOnlyOneStatement,
  useAsyncStyle: useAsyncStyle,
  lastStatementInFn: lastStatementInFn,
  returnedExpressionInFn: returnedExpressionInFn,
  implicitlyReturnedExpressionInFn: implicitlyReturnedExpressionInFn,
  statementIsReturnStatement: statementIsReturnStatement,
  createEvaluatorAst: createEvaluatorAst,
  objToAst: objToAst,
  makeEvaluatorFunction: makeEvaluatorFunction
}

function fnToAst(fn) {
  var fnCode = wrapFunctionToExpressionStatement(fn),
      programAst = esprima.parse(fnCode),
      fnAst = getExpressionFromExpressionStatement(getFirstStatementFromProgram(programAst))

  return fnAst
}

function isArrowFunctionThatImplicitlyReturns(fnAst) {
  return fnAst.type === 'ArrowFunctionExpression' && fnAst.body.type !== 'BlockStatement'
}

function wrapFunctionToExpressionStatement(fn) {
  return '(' + fn.toString() + ')'
}

function bodyContainsOnlyOneStatement(fnAst) {
  return statements(fnAst).length === 1
}

function useAsyncStyle(fnAst) {
  return fnAst.params.length > 1
}

function lastStatementInFn(fnAst) {

  function lastStatement() {
    var arr
    return (arr = statements(fnAst))[arr.length - 1]
  }

  return lastStatement()
}

function statements(fnAst) {
  return fnAst.body.body
}

function returnedExpressionInFn(fnAst) {
  if (isArrowFunctionThatImplicitlyReturns(fnAst))
    return implicitlyReturnedExpressionInFn(fnAst)
  return lastStatementInFn(fnAst).argument
}

function implicitlyReturnedExpressionInFn(fnAst) {
  return fnAst.body
}

function statementIsReturnStatement(stmt) {
  return stmt.type === 'ReturnStatement'
}

function createEvaluatorAst(node, originalParams) {
  var expressionCode = escodegen.generate(node),
      objTemplate = {
        source: expressionCode.replace(/'/g, "\\\'").replace(/\n/g, ''),
        nodeType: node.type,
        evaluator: null,
        position: findPosition(node)
      },
      objAst = objToAst(objTemplate)

  objAst.properties[2].value = makeEvaluatorFunction(node, originalParams)

  return objAst
}

function findPosition(node) {
  if(['BinaryExpression', 'LogicalExpression', 'AssignmentExpression']
     .indexOf(node.type) !== -1) {
    return node.left.loc.end.column + 1
  }
  if(node.type === 'CallExpression') {
    return node.callee.loc.end.column
  }
  if(node.type === 'MemberExpression') {
    return node.property.loc.start.column
  }
  if(['Identifier', 'Literal', 'UnaryExpression', 'UpdateExpression', 'ConditionalExpression',
      'ArrayExpression', 'ObjectExpression', 'FunctionExpression', 'NewExpression']
     .indexOf(node.type) !== -1) {
    return node.loc.start.column
  }
  throw new Error('na-loader error. unhandled node type: ' + node.type)
}

function objToAst(obj) {
  var wrappedSource = '(' + tosource(obj) + ')',
      programAst = esprima.parse(wrappedSource),
      objAst = getExpressionFromExpressionStatement(getFirstStatementFromProgram(programAst))

  return objAst
}

function getFirstStatementFromProgram(programAst) {
  return programAst.body[0]
}

function getExpressionFromExpressionStatement(expressionStatementAst) {
  return expressionStatementAst.expression
}

function makeEvaluatorFunction(node, params) {
  return {
    "type": "FunctionExpression",
    "id": null,
    "params": params || [],
    "defaults": [],
    "body": {
      "type": "BlockStatement",
      "body": [
        {
          "type": "ReturnStatement",
          "argument": node
        }
      ]
    }
  }
}
