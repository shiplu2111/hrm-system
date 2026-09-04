UPDATE employee_tax_profiles etp
SET bank_account_number = '1000' || LPAD(REPLACE(e.employee_number, 'EMP-', ''), 6, '0')
FROM employees e
WHERE e.id = etp.employee_id
  AND etp.bank_account_number IS NULL;
