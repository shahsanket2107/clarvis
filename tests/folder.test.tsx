import { expect } from 'claude-code/testing'
import { test } from './timed'
import { folderName } from '../hooks/hud'

test('the band names the project folder', () => {
  expect(folderName('/work/auth-api', '/home/sam')).toBe('auth-api')
  expect(folderName('/home/sam/code/web/', '/home/sam')).toBe('web')
  expect(folderName('C:\\Users\\Sam\\repo', 'C:\\Users\\Sam')).toBe('repo')
})

test('started from the home folder, it shows ~, never the account name', () => {
  expect(folderName('/Users/sam', '/Users/sam')).toBe('~')
  expect(folderName('/Users/sam/', '/Users/sam')).toBe('~')
  expect(folderName('C:\\Users\\Sam', 'c:\\users\\sam\\')).toBe('~')
})

test('a filesystem or drive root shows /', () => {
  expect(folderName('/', '/Users/sam')).toBe('/')
  expect(folderName('C:\\', undefined)).toBe('/')
})
