const fs = require('fs')
function getFiles(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    file = dir + '/' + file
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file))
    } else {
      results.push(file)
    }
  })
  return results
}

module.exports = {getFiles}