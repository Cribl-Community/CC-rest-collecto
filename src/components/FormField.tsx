import { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface InputProps extends BaseProps, InputHTMLAttributes<HTMLInputElement> {
  as?: 'input';
}

interface SelectProps extends BaseProps, SelectHTMLAttributes<HTMLSelectElement> {
  as: 'select';
  children: ReactNode;
}

interface TextareaProps extends BaseProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
  as: 'textarea';
}

type FormFieldProps = InputProps | SelectProps | TextareaProps;

export function FormField(props: FormFieldProps) {
  const { label, hint, error, required, className, as: element = 'input', ...rest } = props;

  const id = (rest as InputHTMLAttributes<HTMLInputElement>).id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`form-field${className ? ` ${className}` : ''}`}>
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span className="form-required"> *</span>}
      </label>
      {element === 'select' ? (
        <select id={id} className={`form-control${error ? ' form-control--error' : ''}`} {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}>
          {(props as SelectProps).children}
        </select>
      ) : element === 'textarea' ? (
        <textarea id={id} className={`form-control${error ? ' form-control--error' : ''}`} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input id={id} className={`form-control${error ? ' form-control--error' : ''}`} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && !error && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
