const levels = ['debug','info','warn','error']
function shouldLog(level){
  const env = process.env.NODE_ENV || 'development'
  const configured = (process.env.LOG_LEVEL || (env==='development' ? 'debug' : 'info')).toLowerCase()
  const idx = levels.indexOf(level)
  const cfgIdx = levels.indexOf(configured)
  return idx >= cfgIdx
}
function fmt(level, msg, meta){
  const time = new Date().toISOString()
  const base = { level, time }
  const payload = Object.assign(base, (typeof msg==='string'? { message: msg } : msg||{}), meta||{})
  return JSON.stringify(payload)
}
module.exports = {
  debug(msg, meta){ if(shouldLog('debug')) console.log(fmt('debug', msg, meta)) },
  info(msg, meta){ if(shouldLog('info')) console.log(fmt('info', msg, meta)) },
  warn(msg, meta){ if(shouldLog('warn')) console.warn(fmt('warn', msg, meta)) },
  error(msg, meta){ if(shouldLog('error')) console.error(fmt('error', msg, meta)) }
}
