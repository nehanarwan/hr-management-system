exports.up = (pgm) => {
  
  pgm.createTable('leave_policies', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    default_annual_days: { type: 'integer', notNull: true, default: 20 },
    exclude_weekends: { type: 'boolean', notNull: true, default: true },
    exclude_holidays: { type: 'boolean', notNull: true, default: true },
    min_notice_days: { type: 'integer', notNull: true, default: 0 },
    max_consecutive_days: { type: 'integer', notNull: true, default: 30 },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('leave_policies', 'leave_policies_company_unique', { unique: ['company_id'] });
  pgm.addConstraint('leave_policies', 'leave_policies_numbers_check', {
    check: 'default_annual_days > 0 AND min_notice_days >= 0 AND max_consecutive_days > 0',
  });


  pgm.createTable('holidays', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    holiday_date: { type: 'date', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('holidays', 'holidays_company_date_unique', { unique: ['company_id', 'holiday_date'] });

  pgm.createTable('leave_balance', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    employee_id: { type: 'integer', notNull: true },
    year: { type: 'integer', notNull: true },
    total_days: { type: 'integer', notNull: true },
    used_days: { type: 'integer', notNull: true, default: 0 },
    remaining_days: { type: 'integer', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
  });

  pgm.addConstraint('leave_balance', 'leave_balance_employee_year_unique', { unique: ['employee_id', 'year'] });
  pgm.addConstraint('leave_balance', 'leave_balance_days_check', {
    check: 'total_days > 0 AND used_days >= 0 AND used_days <= total_days',
  });
  pgm.addConstraint('leave_balance', 'leave_balance_remaining_check', {
    check: 'remaining_days = total_days - used_days',
  });

 
  pgm.addConstraint('leave_balance', 'leave_balance_employee_fkey', {
    foreignKeys: {
      columns: ['company_id', 'employee_id'],
      references: 'employees(company_id, id)',
      onDelete: 'cascade',
    },
  });

  
  pgm.createTable('leave_request', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    employee_id: { type: 'integer', notNull: true },
    reviewer_id: { type: 'integer' },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    total_days: { type: 'integer', notNull: true },
    user_comment: { type: 'text' },
    reviewer_comment: { type: 'text' },
    status: { type: 'varchar(20)', notNull: true, default: 'Pending' },
    reviewed_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('leave_request', 'leave_request_company_id_id_unique', { unique: ['company_id', 'id'] });
  pgm.addConstraint('leave_request', 'leave_request_dates_check', {
    check: 'start_date <= end_date',
  });
  pgm.addConstraint('leave_request', 'leave_request_total_days_check', {
    check: 'total_days > 0',
  });
  pgm.addConstraint('leave_request', 'leave_request_status_check', {
    check: "status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')",
  });


  pgm.addConstraint('leave_request', 'leave_request_employee_fkey', {
    foreignKeys: {
      columns: ['company_id', 'employee_id'],
      references: 'employees(company_id, id)',
      onDelete: 'cascade',
    },
  });

 
  pgm.addConstraint('leave_request', 'leave_request_reviewer_fkey', {
    foreignKeys: {
      columns: ['company_id', 'reviewer_id'],
      references: 'employees(company_id, id)',
    },
  });

  pgm.createTable('request_response', {
    id: 'id',
    company_id: { type: 'integer', notNull: true, references: 'companies', onDelete: 'cascade' },
    leave_request_id: { type: 'integer', notNull: true },
    reviewer_id: { type: 'integer' },
    head_comment: { type: 'text' },
    status: { type: 'varchar(20)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('request_response', 'request_response_status_check', {
    check: "status IN ('Approved', 'Rejected')",
  });

 
  pgm.addConstraint('request_response', 'request_response_request_fkey', {
    foreignKeys: {
      columns: ['company_id', 'leave_request_id'],
      references: 'leave_request(company_id, id)',
      onDelete: 'cascade',
    },
  });

  
  pgm.addConstraint('request_response', 'request_response_reviewer_fkey', {
    foreignKeys: {
      columns: ['company_id', 'reviewer_id'],
      references: 'employees(company_id, id)',
    },
  });

  
  pgm.createIndex('leave_balance', ['company_id', 'employee_id']);
  pgm.createIndex('leave_request', ['company_id', 'employee_id']);
  pgm.createIndex('leave_request', ['company_id', 'status']);
  pgm.createIndex('request_response', ['company_id', 'leave_request_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('request_response');
  pgm.dropTable('leave_request');
  pgm.dropTable('leave_balance');
  pgm.dropTable('holidays');
  pgm.dropTable('leave_policies');
};