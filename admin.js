jQuery(document).ready(function($) {
    function toggleApiFields() {
        var mode = $('#woocommerce_bumperpay_paylater_mode').val() || $('#woocommerce_bumperpay_paynow_mode').val();
        if (mode === 'test') {
            $('.test-fields').closest('tr').show();
            $('.live-fields').closest('tr').hide();
        } else {
            $('.test-fields').closest('tr').hide();
            $('.live-fields').closest('tr').show();
        }
    }

    // Initial call to toggle fields based on current mode
    toggleApiFields();

    // Event listener for mode change
    $('#woocommerce_bumperpay_paylater_mode, #woocommerce_bumperpay_paynow_mode').change(function() {
        toggleApiFields();
    });
});
