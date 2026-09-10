function WalletIllustration() {
  return (
    <div className="wallet-illustration" aria-hidden="true">
      <svg
        viewBox="0 0 366 250"
        role="presentation"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer wallet body */}
        <rect x="4" y="4" width="358" height="242" rx="34" fill="#333333" />

        {/* Inner dark layer */}
        <rect x="18" y="18" width="330" height="214" rx="30" fill="#242424" />

        {/* Card slot */}
        <path
          d="
            M42 32
            H324
            A22 22 0 0 1 346 54
            V140
            H20
            V54
            A22 22 0 0 1 42 32
            Z
          "
          fill="#e7e7e7"
        />

        {/* Front pocket */}
        <path
          d="
            M4 96
            H362
            V212
            A34 34 0 0 1 328 246
            H38
            A34 34 0 0 1 4 212
            Z
          "
          fill="#181818"
        />
      </svg>
    </div>
  );
}

export default WalletIllustration;
