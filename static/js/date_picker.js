// var space_floorplan = new SpaceFloorplan();
let current_date = new Date().toISOString().slice(0, 10).split('-').join('/');
$(function () {

  $('input[name="datefilter"]').daterangepicker({
    showDropdowns: true,
    timePicker: true,
    format: 'dd/mm/yy' ,
    locale: { format: 'DD/MM/YYYY' },
    timePickerIncrement: 15,
    opens: "center"
  }, function (start, end, label) {
    //let URLhistoric_test_url='https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/history/'+link_id+'/?start_date='+start_date+'&end_date='+end_date
    console.log('New date range selected: ' + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD') +
      ' (predefined range: ' + label + ')');
    console.log(start, start._d.getTime(), end, end._d.getTime()); //.getTime() / 1000
    let start_date = start.format('YYYY-MM-DD');
    let end_date = end.format('YYYY-MM-DD');
    show_node_information(selected_node, start_date, end_date);

  });


  $('input[name="datefilter"]').on('apply.daterangepicker', function (ev, picker) {
    $(this).val(picker.startDate.format('YYYY-MM-DD') + ' - ' + picker.endDate.format('YYYY-MM-DD'));
    let start_date = picker.startDate.format('YYYY-MM-DD');
    let end_date = picker.endDate.format('YYYY-MM-DD')
    console.log('applied', start_date, end_date)
    show_node_information(selected_node, start_date, end_date);

  });

  $('input[name="datefilter"]').on('cancel.daterangepicker', function (ev, picker) {
    $(this).val('');
  });

});