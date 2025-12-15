import { ZontaxParser } from './src/index';

async function testRecordEnum() {
  const parser = new ZontaxParser();
  
  // Test case 1: Simple record with string keys (should work)
  try {
    const result = await parser.parse(`Z.record(Z.string(), Z.number())`);
    console.log('✓ Simple record works');
    console.log('  Generated:', result.schema);
  } catch (e) {
    console.log('✗ Simple record failed:', e.message);
  }

  // Test case 2: Record with enum as key type
  try {
    const result = await parser.parse(`Z.record(
      Z.enum(['Goblin', 'Dwarven', 'Undead', 'Cultist']), 
      Z.number()
    )`);
    console.log('✓ Record with enum key works');
    console.log('  Generated:', result.schema);
  } catch (e) {
    console.log('✗ Record with enum key failed:', e.message);
  }

  // Test case 3: Alternative - object with specific keys
  try {
    const result = await parser.parse(`Z.object({
      Goblin: Z.number(),
      Dwarven: Z.number(),
      Undead: Z.number(),
      Cultist: Z.number()
    })`);
    console.log('✓ Object with specific keys works');
    console.log('  Generated:', result.schema);
  } catch (e) {
    console.log('✗ Object with specific keys failed:', e.message);
  }

  // Test case 4: Record in object context
  try {
    const result = await parser.parse(`Z.object({
      name: Z.string(),
      enemyStats: Z.record(Z.string(), Z.number())
    })`);
    console.log('✓ Record in object context works');
    console.log('  Generated:', result.schema);
  } catch (e) {
    console.log('✗ Record in object context failed:', e.message);
  }
}

testRecordEnum();