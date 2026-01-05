-- Delete legacy test claims for 1fairdeal@gmail.com
DELETE FROM claims_submissions 
WHERE id IN (
  '3fdc5620-072a-47f5-ae9b-da016fa4d21b',
  '4c6b4869-cddc-4ce4-a098-f1aaa3a0af9c',
  'a8fd5377-f046-491e-a2ac-fae87a5baf3d'
);