export interface ButtonProps {
    type?: 'button' | 'submit',
    color?: 'default' | 'disabled' | 'success' | 'info' | 'warning' | 'danger', // 323232, 191919, 00b728, 1e40af, f59e0b, d21a1a
    size?: 'sm' | 'md' | 'lg' | 'xl',
    disabled?: boolean,
    children: any,
}

const colors = {
    default: 'text-neutral-100 bg-[#323232] border border-[#323232] hover:text-[#323232] dark:hover:text-white',
    disabled: 'text-neutral-100 bg-[#9f9f9f] dark:bg-[#191919] border border-[#9f9f9f] dark:border-[#191919] disabled cursor-not-allowed',
    success: 'text-neutral-100 hover:text-[#00b728] bg-[#00b728] border border-[#00b728]',
    info: 'text-neutral-100 hover:text-[#1e40af] bg-[#1e40af] border border-[#1e40af]',
    warning: 'text-neutral-100 hover:text-[#f59e0b] bg-[#f59e0b] border border-[#f59e0b]',
    danger: 'text-neutral-100 hover:text-[#d21a1a] bg-[#d21a1a] border border-[#d21a1a]',
}

const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
    xl: 'px-6 py-3 text-lg',
}


const Button = ({type = 'button', color = 'default', size = 'md', disabled = false, children, ...rest}: ButtonProps) =>
    <button disabled={color === 'disabled' || disabled}
            type={type}
            class={`inline-flex items-center justify-center rounded-md shadow-sm font-medium focus:outline-none focus:ring-0 focus:ring-none ${sizes[size]} ${(disabled || color === 'disabled') ? colors['disabled'] : `${colors[color]} hover:bg-transparent`} transition duration-300 ${rest.class || ''}`}>
        {children}
    </button>

export default Button