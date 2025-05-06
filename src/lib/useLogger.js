'use client'

import { createClientLogger } from './clientLogger'
import { useCallback } from 'react'

export function useLogger(componentName = '') {
  const logger = createClientLogger()
  
  const enhancedLogger = {
    log: useCallback((message, meta = {}) => {
      logger.log(message, { component: componentName, ...meta })
    }, [componentName]),
    
    info: useCallback((message, meta = {}) => {
      logger.info(message, { component: componentName, ...meta })
    }, [componentName]),
    
    warn: useCallback((message, meta = {}) => {
      logger.warn(message, { component: componentName, ...meta })
    }, [componentName]),
    
    error: useCallback((message, meta = {}) => {
      logger.error(message, { component: componentName, ...meta })
    }, [componentName]),
    
    debug: useCallback((message, meta = {}) => {
      logger.debug(message, { component: componentName, ...meta })
    }, [componentName])
  }
  
  return enhancedLogger
} 