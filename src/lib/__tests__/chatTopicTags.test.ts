import { describe, it, expect } from 'vitest';
import { classifyChatTopic } from '../chatTopicTags';

describe('chat Claim tag', () => {
  it('does not tag claim-limit questions as Claim', () => {
    expect(classifyChatTopic('what is the claim limit on platinum').key).not.toBe('claim');
  });
  it('tags a request to make a claim as Claim', () => {
    expect(classifyChatTopic('I want to make a claim').key).toBe('claim');
  });
});
