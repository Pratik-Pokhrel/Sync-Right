const FormInput = ({ label, type, id, name, value, onChange, placeholder, required = false, error = null }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-amber-800 mb-2">
        {label}
      </label>
      <input
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-amber-50/50 transition-colors ${
          error
            ? 'border-red-300 focus:ring-red-500'
            : 'border-amber-300 focus:ring-amber-500'
        }`}
        placeholder={placeholder}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default FormInput;