import { useState } from 'react';

const FormInput = ({ label, type, id, name, value, onChange, placeholder, required = false, error = null, className = '' }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === 'password';
  const inputType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-200 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className={`w-full px-4 py-3 rounded-2xl border text-white bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:border-transparent ${
            error
              ? 'border-rose-400/70 bg-rose-500/10 focus:ring-rose-400'
              : 'border-white/20 focus:ring-cyan-400'
          } ${isPasswordField ? 'pr-12' : ''} ${className}`}
          placeholder={placeholder}
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-3 flex items-center text-slate-300 hover:text-white focus:outline-none"
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="M12 5c-7.633 0-11 6.533-11 7s3.367 7 11 7 11-6.533 11-7-3.367-7-11-7zm0 12c-2.761 0-5-2.239-5-5 0-.562.103-1.098.286-1.592l6.306 6.306c-.494.183-1.03.286-1.592.286zm4.714-2.408l-1.509-1.509 1.418-1.418 1.509 1.509c.102.102.102.268 0 .37l-1.418 1.418zm-8.84-8.84l1.509 1.509-1.418 1.418-1.509-1.509c-.102-.102-.102-.268 0-.37l1.418-1.418z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="M12 4.5c-7.633 0-11 6.533-11 7s3.367 7 11 7 11-6.533 11-7-3.367-7-11-7zm0 12c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5zm0-8.5c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-rose-300">{error}</p>
      )}
    </div>
  );
};

export default FormInput;