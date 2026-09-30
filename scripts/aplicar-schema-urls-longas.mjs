// Aplica uma única vez a atualização obrigatória do Prisma para links longos.
// O resultado alterado em prisma/schema.prisma PRECISA ser commitado antes do
// merge desta feature. Não basta apenas executar a migration.sql.
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'prisma/schema.prisma'
let schema = readFileSync(path, 'utf8')

function updateModel(name, update) {
  const marker = `model ${name} {`
  const start = schema.indexOf(marker)
  if (start === -1) throw new Error(`Modelo não encontrado: ${name}`)
  const end = schema.indexOf('\n}', start)
  if (end === -1) throw new Error(`Fim do modelo não encontrado: ${name}`)
  const original = schema.slice(start, end + 2)
  const altered = update(original)
  if (altered === original) throw new Error(`Nada a atualizar no modelo ${name}. Verifique se já foi corrigido.`)
  schema = schema.slice(0, start) + altered + schema.slice(end + 2)
}

function urlToText(model, field, expectedType) {
  const expression = new RegExp(`(^\\s*${field}\\s+${expectedType}\\s+(?:@map\\("[^"]+"\\)\\s+)?)@db\\.VarChar\\((?:500|1000)\\)`, 'm')
  if (!expression.test(model)) throw new Error(`Campo ainda não compatível com o ajuste: ${field}`)
  return model.replace(expression, '$1@db.Text')
}

updateModel('Oferta', (model) => {
  model = urlToText(model, 'urlOriginal', 'String')
  model = urlToText(model, 'urlAfiliada', 'String\\?')
  const unique = '  @@unique([produtoId, parceiroId, urlOriginal])\n'
  if (!model.includes(unique)) throw new Error('Chave única original de oferta não encontrada')
  // Unicidade por hash SHA-256 de tamanho fixo é mantida pela migration SQL.
  return model.replace(unique, '')
})
updateModel('SugestaoOferta', (model) => urlToText(model, 'urlOriginal', 'String'))
updateModel('ChatbotCadastroToken', (model) => urlToText(model, 'url', 'String'))
writeFileSync(path, schema)
console.log('Schema Prisma atualizado. Revise o diff e faça commit antes do merge.')
