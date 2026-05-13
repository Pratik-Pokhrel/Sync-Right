const FormInput = ({ label, type, id, name, value, onChange, placeholder, required = false }) => {
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
        className="w-full px-4 py-3 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-amber-50/50"
        placeholder={placeholder}
      />
    </div>
  );
};

export default FormInput;